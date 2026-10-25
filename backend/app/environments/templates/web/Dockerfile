FROM python:3.14-slim AS base
ENV PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential ca-certificates curl git procps \
 && rm -rf /var/lib/apt/lists/*
COPY --from=node:24-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:24-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
RUN useradd --uid 1000 --create-home --shell /bin/bash dev
WORKDIR /workspace

FROM base AS dev
USER dev
CMD ["sleep", "infinity"]
