using HiFiStore.Domain.Orders;

namespace HiFiStore.Tests.Orders;

public class OrderWorkflowTests
{
    [Theory]
    [InlineData(OrderStatus.New, OrderStatus.Confirmed)]
    [InlineData(OrderStatus.New, OrderStatus.Cancelled)]
    [InlineData(OrderStatus.Confirmed, OrderStatus.Shipped)]
    [InlineData(OrderStatus.Confirmed, OrderStatus.Cancelled)]
    [InlineData(OrderStatus.Shipped, OrderStatus.Completed)]
    [InlineData(OrderStatus.Shipped, OrderStatus.Cancelled)]
    public void AllowedTransitions(OrderStatus from, OrderStatus to) =>
        Assert.True(OrderWorkflow.CanTransition(from, to));

    [Theory]
    [InlineData(OrderStatus.New, OrderStatus.New)]
    [InlineData(OrderStatus.New, OrderStatus.Shipped)]
    [InlineData(OrderStatus.New, OrderStatus.Completed)]
    [InlineData(OrderStatus.Confirmed, OrderStatus.New)]
    [InlineData(OrderStatus.Confirmed, OrderStatus.Completed)]
    [InlineData(OrderStatus.Shipped, OrderStatus.Confirmed)]
    [InlineData(OrderStatus.Completed, OrderStatus.Cancelled)]
    [InlineData(OrderStatus.Cancelled, OrderStatus.New)]
    [InlineData(OrderStatus.Cancelled, OrderStatus.Confirmed)]
    public void ForbiddenTransitions(OrderStatus from, OrderStatus to) =>
        Assert.False(OrderWorkflow.CanTransition(from, to));

    [Fact]
    public void FinalStatuses_HaveNoNextStatuses()
    {
        Assert.Empty(OrderWorkflow.NextStatuses(OrderStatus.Completed));
        Assert.Empty(OrderWorkflow.NextStatuses(OrderStatus.Cancelled));
    }

    [Fact]
    public void EveryStatus_HasTransitionsDefined()
    {
        foreach (var status in Enum.GetValues<OrderStatus>())
        {
            // Не падает и не возвращает null для любого статуса, включая будущие.
            Assert.NotNull(OrderWorkflow.NextStatuses(status));
        }
    }
}
