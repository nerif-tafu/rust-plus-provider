# Rust+ Provider - Node 22 + Chrome for Selenium
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    unzip \
    curl \
    gnupg \
    ca-certificates \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Install ChromeDriver matching the Chrome that was actually installed above.
# Resolve the driver from the installed Chrome's major version rather than from
# LATEST_RELEASE_STABLE: chrome-for-testing publishes a new major before the apt
# repo serves it, which otherwise pairs e.g. ChromeDriver 151 with Chrome 150 and
# breaks every session with "only supports Chrome version N".
RUN set -eux; \
    CHROME_VERSION="$(google-chrome-stable --version | grep -oE '[0-9]+(\.[0-9]+){2,3}')"; \
    CHROME_MAJOR="${CHROME_VERSION%%.*}"; \
    CHROMEDRIVER_VERSION="$(curl -fsS "https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_${CHROME_MAJOR}" \
        || curl -fsS "https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_STABLE")"; \
    echo "Chrome ${CHROME_VERSION} (major ${CHROME_MAJOR}) -> ChromeDriver ${CHROMEDRIVER_VERSION}"; \
    wget -q -O /tmp/chromedriver.zip "https://storage.googleapis.com/chrome-for-testing-public/${CHROMEDRIVER_VERSION}/linux64/chromedriver-linux64.zip"; \
    unzip -o /tmp/chromedriver.zip -d /tmp/; \
    mv /tmp/chromedriver-linux64/chromedriver /usr/local/bin/; \
    chmod +x /usr/local/bin/chromedriver; \
    rm -rf /tmp/chromedriver*; \
    DRIVER_MAJOR="$(chromedriver --version | grep -oE '[0-9]+(\.[0-9]+){2,3}' | head -1 | cut -d. -f1)"; \
    test "${DRIVER_MAJOR}" = "${CHROME_MAJOR}" \
        || { echo "ChromeDriver ${DRIVER_MAJOR} does not match Chrome ${CHROME_MAJOR}"; exit 1; }

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=9443
EXPOSE 9443

CMD ["node", "server.js"]
