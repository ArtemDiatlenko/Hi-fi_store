FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish src/HiFiStore.Api -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .
ENV ASPNETCORE_ENVIRONMENT=Production
# Render передаёт порт в $PORT
CMD sh -c "exec dotnet HiFiStore.Api.dll --urls http://0.0.0.0:${PORT:-8080}"
