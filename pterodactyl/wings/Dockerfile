FROM debian:12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && curl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_amd64" \
    && chmod +x /usr/local/bin/wings

WORKDIR /etc/pterodactyl

ENTRYPOINT ["/usr/local/bin/wings", "--config", "/etc/pterodactyl/config.yml"]
