# CheckMCP self-hosted Gateway — a single-backend MCP security proxy you run in your own infra.
# Build:  docker build -t checkmcp-gateway .
# Run:    docker run -p 8080:8080 \
#           -e GATEWAY_BACKEND_URL=https://mcp.example.com/mcp \
#           -e GATEWAY_MODE=active -e GATEWAY_BLOCK_INJECTION=1 \
#           -e GATEWAY_SECRET=$(openssl rand -hex 16) \
#           checkmcp-gateway
# Point your agent at  http://<host>:8080/mcp  with header  Authorization: Bearer <GATEWAY_SECRET>.
FROM python:3.12-slim

LABEL org.opencontainers.image.title="CheckMCP Gateway" \
      org.opencontainers.image.description="Self-hosted MCP security gateway (inspect/block tool poisoning & exfiltration)" \
      org.opencontainers.image.source="https://github.com/H129hj/checkmcp"

WORKDIR /app
COPY checkmcp ./checkmcp

ENV GATEWAY_PORT=8080 GATEWAY_MODE=passive PYTHONUNBUFFERED=1
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=3s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/health',timeout=3).status==200 else 1)"

# stdlib only — no pip install needed. Run as non-root.
RUN useradd -r -u 10001 gw
USER gw
CMD ["python", "-m", "checkmcp.gateway"]
