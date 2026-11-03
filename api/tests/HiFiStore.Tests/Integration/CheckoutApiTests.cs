using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Npgsql;
using static HiFiStore.Tests.Integration.OrderTestHelpers;

namespace HiFiStore.Tests.Integration;

public sealed class CheckoutApiTests(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [SkippableFact]
    public async Task Guest_CreatesOrder_WithCatalogPrices_AndDecreasesStock()
    {
        await PrepareAsync(factory);
        var product = await CreateProductAsync(factory, stock: 5, price: 1234.50m);

        // Цены и сумма от клиента игнорируются: сервер берёт их из каталога.
        var body = CheckoutBody((product.Id, 2));
        body["items"] = new[] { new { productId = product.Id, quantity = 2, unitPrice = 1m } };
        body["total"] = 1m;

        var response = await PostOrderAsync(_client, body);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var token = json.GetProperty("token").GetString()!;
        Assert.Equal(43, token.Length);
        Assert.Equal($"/api/orders/by-token/{token}", response.Headers.Location?.OriginalString);

        var order = json.GetProperty("order");
        Assert.True(order.GetProperty("number").GetInt64() >= 100001);
        Assert.Equal("New", order.GetProperty("status").GetString());
        Assert.Equal(2469.00m, order.GetProperty("total").GetDecimal());
        var item = Assert.Single(order.GetProperty("items").EnumerateArray());
        Assert.Equal(1234.50m, item.GetProperty("unitPrice").GetDecimal());
        Assert.Equal(2, item.GetProperty("quantity").GetInt32());
        Assert.Equal(2469.00m, item.GetProperty("lineTotal").GetDecimal());
        Assert.Equal(product.Name, item.GetProperty("name").GetString());

        Assert.Equal("+380671234567", order.GetProperty("customer").GetProperty("phone").GetString());
        var delivery = order.GetProperty("delivery");
        Assert.Equal("NovaPoshtaWarehouse", delivery.GetProperty("method").GetString());
        Assert.Equal("Отделение №12", delivery.GetProperty("warehouse").GetString());
        Assert.Equal(JsonValueKind.Null, delivery.GetProperty("cityRef").ValueKind);

        Assert.Equal(3, await GetStockAsync(factory, product.Id));
    }

    [SkippableFact]
    public async Task OrderNumbers_AreUnique_AndGrow()
    {
        await PrepareAsync(factory);
        var product = await CreateProductAsync(factory, stock: 10);

        var first = await PlaceOrderAsync(_client, CheckoutBody((product.Id, 1)));
        var second = await PlaceOrderAsync(_client, CheckoutBody((product.Id, 1)));

        Assert.True(Number(second) > Number(first));
        Assert.NotEqual(first.GetProperty("token").GetString(), second.GetProperty("token").GetString());
    }

    [SkippableFact]
    public async Task InvalidData_ReturnsRussianFieldErrors_AndKeepsStock()
    {
        await PrepareAsync(factory);
        var product = await CreateProductAsync(factory, stock: 5);

        var response = await PostOrderAsync(_client, new
        {
            items = new object[]
            {
                new { productId = product.Id, quantity = 0 },
                new { productId = Guid.Empty, quantity = 1 },
            },
            fullName = " ",
            phone = "123",
            email = "not-an-email",
            deliveryMethod = "NovaPoshtaWarehouse",
            paymentMethod = "Bitcoin",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        foreach (var field in new[] { "items[0].quantity", "items[1].productId", "fullName", "phone", "email", "city", "warehouse", "paymentMethod" })
        {
            Assert.True(errors.TryGetProperty(field, out _), $"Нет ошибки для поля {field}: {errors}");
        }

        Assert.False(errors.TryGetProperty("address", out _));
        Assert.Equal("Укажите город.", errors.GetProperty("city")[0].GetString());
        Assert.Equal("Укажите имя и фамилию.", errors.GetProperty("fullName")[0].GetString());
        Assert.Equal(5, await GetStockAsync(factory, product.Id));
    }

    [SkippableFact]
    public async Task EmptyCart_IsRejected()
    {
        await PrepareAsync(factory);

        var body = CheckoutBody();
        var response = await PostOrderAsync(_client, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.Equal("Корзина пуста.", errors.GetProperty("items")[0].GetString());
    }

    [SkippableFact]
    public async Task Courier_RequiresAddress_Pickup_DoesNotNeedCity()
    {
        await PrepareAsync(factory);
        var product = await CreateProductAsync(factory, stock: 5);

        var courier = CheckoutBody((product.Id, 1));
        courier["deliveryMethod"] = "NovaPoshtaCourier";
        var courierResponse = await PostOrderAsync(_client, courier);
        Assert.Equal(HttpStatusCode.BadRequest, courierResponse.StatusCode);
        var errors = (await courierResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.True(errors.TryGetProperty("address", out _));
        Assert.False(errors.TryGetProperty("warehouse", out _));

        var pickup = CheckoutBody((product.Id, 1));
        pickup["deliveryMethod"] = "Pickup";
        pickup.Remove("city");
        pickup["warehouse"] = "лишнее поле";
        pickup["paymentMethod"] = "BankTransfer";
        var placed = await PlaceOrderAsync(_client, pickup);

        var delivery = placed.GetProperty("order").GetProperty("delivery");
        Assert.Equal("Pickup", delivery.GetProperty("method").GetString());
        Assert.Equal(JsonValueKind.Null, delivery.GetProperty("warehouse").ValueKind);
        Assert.Equal("BankTransfer", placed.GetProperty("order").GetProperty("paymentMethod").GetString());
    }

    [SkippableFact]
    public async Task UnpublishedOrUnknownProduct_IsRejected()
    {
        await PrepareAsync(factory);
        var draft = await CreateProductAsync(factory, stock: 5, published: false);

        var response = await PostOrderAsync(_client, CheckoutBody((draft.Id, 1), (Guid.NewGuid(), 1)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.Equal("Товар не найден или снят с продажи.", errors.GetProperty("items[0].productId")[0].GetString());
        Assert.True(errors.TryGetProperty("items[1].productId", out _));
        Assert.Equal(5, await GetStockAsync(factory, draft.Id));
    }

    [SkippableFact]
    public async Task NotEnoughStock_Returns409_NamingTheItems()
    {
        await PrepareAsync(factory);
        var scarce = await CreateProductAsync(factory, stock: 1);
        var plenty = await CreateProductAsync(factory, stock: 10);

        var response = await PostOrderAsync(_client, CheckoutBody((plenty.Id, 1), (scarce.Id, 2)));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        var item = Assert.Single(problem.GetProperty("items").EnumerateArray());
        Assert.Equal(scarce.Id, item.GetProperty("productId").GetGuid());
        Assert.Equal(2, item.GetProperty("requested").GetInt32());
        Assert.Equal(1, item.GetProperty("available").GetInt32());
        Assert.Contains(scarce.Name, problem.GetProperty("detail").GetString());

        Assert.Equal(1, await GetStockAsync(factory, scarce.Id));
        Assert.Equal(10, await GetStockAsync(factory, plenty.Id));
    }

    [SkippableFact]
    public async Task ParallelOrders_DoNotOversell()
    {
        await PrepareAsync(factory);
        var product = await CreateProductAsync(factory, stock: 3);

        var responses = await Task.WhenAll(Enumerable.Range(0, 12)
            .Select(_ => PostOrderAsync(_client, CheckoutBody((product.Id, 1)))));

        Assert.Equal(3, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(9, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(0, await GetStockAsync(factory, product.Id));
    }

    /// <summary>
    /// Детерминированная проверка гонки: строка товара заблокирована, оба запроса прошли предварительную
    /// проверку (остаток 1 виден обоим) и ждут на UPDATE. После снятия блокировки списание проходит
    /// только у одного — второй перепроверяет условие на новом остатке и получает 409.
    /// </summary>
    [SkippableFact]
    public async Task ConcurrentOrders_ForLastItem_OnlyOneSucceeds()
    {
        await PrepareAsync(factory);
        var product = await CreateProductAsync(factory, stock: 1);

        await using var locker = new NpgsqlConnection(StoreWebApplicationFactory.ConnectionString);
        await locker.OpenAsync();
        var lockTransaction = await locker.BeginTransactionAsync();
        await using (var select = new NpgsqlCommand(
            "SELECT 1 FROM \"Products\" WHERE \"Id\" = @id FOR UPDATE", locker, lockTransaction))
        {
            select.Parameters.AddWithValue("id", product.Id);
            await select.ExecuteNonQueryAsync();
        }

        var first = PostOrderAsync(_client, CheckoutBody((product.Id, 1)));
        var second = PostOrderAsync(_client, CheckoutBody((product.Id, 1)));

        var bothWaiting = await WaitForBlockedStockUpdatesAsync(expected: 2, TimeSpan.FromSeconds(15));
        await lockTransaction.CommitAsync();
        var responses = await Task.WhenAll(first, second);

        Assert.True(bothWaiting, "Оба запроса должны были дойти до списания и ждать блокировку строки товара.");
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(0, await GetStockAsync(factory, product.Id));
    }

    [SkippableFact]
    public async Task ByToken_ReturnsConfirmation_NumberAndWrongTokenDoNot()
    {
        await PrepareAsync(factory);
        var product = await CreateProductAsync(factory, stock: 5);
        var placed = await PlaceOrderAsync(_client, CheckoutBody((product.Id, 1)));
        var token = placed.GetProperty("token").GetString()!;
        var number = Number(placed);

        var confirmation = await _client.GetFromJsonAsync<JsonElement>($"/api/orders/by-token/{token}");
        Assert.Equal(number, confirmation.GetProperty("number").GetInt64());
        Assert.Equal(product.Name, confirmation.GetProperty("items")[0].GetProperty("name").GetString());

        var tampered = (token[0] == 'A' ? 'B' : 'A') + token[1..];
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/orders/by-token/{tampered}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/orders/by-token/short")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/orders/by-token/{number}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/orders/{number}")).StatusCode);
    }

    [SkippableFact]
    public async Task ExpiredOrInvalidToken_Returns401_InsteadOfGuestOrder()
    {
        await PrepareAsync(factory);
        var product = await CreateProductAsync(factory, stock: 5);

        var response = await PostOrderAsync(_client, CheckoutBody((product.Id, 1)), token: "not-a-valid-token");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(5, await GetStockAsync(factory, product.Id));
    }

    [SkippableFact]
    public async Task CartQuote_UsesCatalogPrices_AndFlagsProblems()
    {
        await PrepareAsync(factory);
        var available = await CreateProductAsync(factory, stock: 5, price: 500m);
        var scarce = await CreateProductAsync(factory, stock: 1, price: 300m);
        var draft = await CreateProductAsync(factory, stock: 5, published: false);

        var response = await _client.PostAsJsonAsync("/api/cart/quote", new
        {
            items = new[]
            {
                new { productId = available.Id, quantity = 2 },
                new { productId = scarce.Id, quantity = 3 },
                new { productId = draft.Id, quantity = 1 },
            },
        });

        response.EnsureSuccessStatusCode();
        var quote = await response.Content.ReadFromJsonAsync<JsonElement>();
        var lines = quote.GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(["Ok", "InsufficientStock", "Unavailable"], lines.Select(l => l.GetProperty("status").GetString()));
        Assert.Equal(1000m, lines[0].GetProperty("lineTotal").GetDecimal());
        Assert.Equal(1, lines[1].GetProperty("availableStock").GetInt32());
        Assert.Equal(JsonValueKind.Null, lines[2].GetProperty("name").ValueKind);
        Assert.Equal(1900m, quote.GetProperty("total").GetDecimal());
        Assert.False(quote.GetProperty("canCheckout").GetBoolean());

        var invalid = await _client.PostAsJsonAsync("/api/cart/quote", new
        {
            items = new[] { new { productId = available.Id, quantity = 1000 } },
        });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
    }

    private static long Number(JsonElement placed) => placed.GetProperty("order").GetProperty("number").GetInt64();

    private static async Task<bool> WaitForBlockedStockUpdatesAsync(int expected, TimeSpan timeout)
    {
        // Отдельное соединение вне транзакции: внутри транзакции pg_stat_activity возвращает снимок.
        await using var monitor = new NpgsqlConnection(StoreWebApplicationFactory.ConnectionString);
        await monitor.OpenAsync();
        await using var count = new NpgsqlCommand(
            """
            SELECT count(*) FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE 'UPDATE "Products"%'
            """,
            monitor);

        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if ((long)(await count.ExecuteScalarAsync())! >= expected)
            {
                return true;
            }

            await Task.Delay(50);
        }

        return false;
    }
}
