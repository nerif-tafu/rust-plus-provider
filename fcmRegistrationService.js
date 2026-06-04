// fcmRegistrationService.js - Handles FCM registration with Selenium automation
const { Builder, By, until } = require('selenium-webdriver');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const AndroidFCM = require('@liamcottle/push-receiver/src/android/fcm');
const PushReceiverClient = require('@liamcottle/push-receiver/src/client');

function getUrlHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** True only when the browser is actually on the Rust+ site (not Steam URLs that mention it in query params). */
function isRustPlusPageUrl(url) {
  return getUrlHostname(url) === 'companion-rust.facepunch.com';
}

function isSteamOpenIdConsentUrl(url) {
  return /\/openid\/login/i.test(url) && !/loginform/i.test(url);
}

function isSteamLoginformUrl(url) {
  return /\/openid\/loginform/i.test(url);
}

/** When SELENIUM_HEADLESS is unset, empty, or invalid, default to headless (true). */
function isSeleniumHeadless() {
  const raw = process.env.SELENIUM_HEADLESS;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return true;
  }
  const normalized = String(raw).trim().toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  return true;
}

const STEAM_LOGIN_USERNAME_LOCATORS = [
  By.css('[data-featuretarget="login"] form input[type="text"]'),
  By.xpath('//div[@data-featuretarget="login"]//form//input[@type="text"]'),
  By.xpath(
    '//label[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "account name")]/following::input[1]'
  ),
  By.xpath('//form[.//input[@type="password"]][1]//input[@type="text"][1]'),
  By.css('div.login_featuretarget_ctn form input[type="text"]'),
  By.css('form input[type="text"]'),
];

const STEAM_LOGIN_PASSWORD_LOCATORS = [
  By.css('[data-featuretarget="login"] form input[type="password"]'),
  By.xpath('//div[@data-featuretarget="login"]//form//input[@type="password"]'),
  By.xpath(
    '//label[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "password")]/following::input[@type="password"][1]'
  ),
  By.xpath('//form[.//input[@type="password"]][1]//input[@type="password"][1]'),
  By.css('div.login_featuretarget_ctn form input[type="password"]'),
  By.css('form input[type="password"]'),
];

const STEAM_LOGIN_SUBMIT_LOCATORS = [
  By.css('[data-featuretarget="login"] form button[type="submit"]'),
  By.xpath('//div[@data-featuretarget="login"]//form//button[@type="submit"]'),
  By.xpath('//form[.//input[@type="password"]]//button[@type="submit"]'),
  By.xpath(
    '//form[.//input[@type="password"]]//button[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "sign in")]'
  ),
  By.xpath('//button[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "sign in")]'),
];

const STEAM_OPENID_SIGN_IN_LOCATORS = [
  By.id('imageLogin'),
  By.css('input#imageLogin[type="submit"]'),
  By.xpath('//form[@id="openidForm"]//input[@type="submit"]'),
  By.xpath('//input[@type="submit" and translate(@value, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")="sign in"]'),
];

const STEAM_LOGIN_DISCOVERY_SCRIPT = `
  const norm = (value) => (value || '').trim().toLowerCase().replace(/\\s+/g, ' ');
  const isVisible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none';
  };

  const loginRoot =
    document.querySelector('[data-featuretarget="login"]') ||
    document.querySelector('.login_featuretarget_ctn') ||
    document.body;

  const forms = Array.from(loginRoot.querySelectorAll('form')).filter(isVisible);
  const loginForm =
    forms.find((form) => form.querySelector('input[type="password"]') && form.querySelector('input[type="text"], input:not([type])')) ||
    forms[0];

  if (!loginForm) {
    return [null, null, null];
  }

  const inputs = Array.from(loginForm.querySelectorAll('input')).filter(isVisible);
  const textInputs = inputs.filter((input) => {
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    return type === 'text' || type === 'email' || type === '';
  });
  const passwordInput = inputs.find((input) => (input.getAttribute('type') || '').toLowerCase() === 'password');

  const labelTextFor = (input) => {
    if (!input) return '';
    const id = input.getAttribute('id');
    const label = id ? loginRoot.querySelector('label[for="' + CSS.escape(id) + '"]') : null;
    return norm(label ? label.textContent : '');
  };

  let usernameInput = null;
  for (const input of textInputs) {
    const haystack = [
      labelTextFor(input),
      norm(input.getAttribute('aria-label')),
      norm(input.getAttribute('placeholder')),
      norm(input.getAttribute('name')),
      norm(input.getAttribute('autocomplete')),
    ].join(' ');

    if (
      haystack.includes('account name') ||
      haystack.includes('account') ||
      haystack.includes('username') ||
      haystack.includes('user name') ||
      haystack.includes('sign in with')
    ) {
      usernameInput = input;
      break;
    }
  }

  if (!usernameInput && textInputs.length > 0) {
    usernameInput = textInputs.find((input) => loginForm.contains(input)) || textInputs[0];
  }

  let signInButton =
    loginForm.querySelector('button[type="submit"]') ||
    Array.from(loginForm.querySelectorAll('button')).find((button) => norm(button.textContent).includes('sign in'));

  if (!signInButton) {
    signInButton = Array.from(document.querySelectorAll('button')).find(
      (button) => isVisible(button) && norm(button.textContent) === 'sign in'
    );
  }

  return [usernameInput, passwordInput, signInButton];
`;

class FcmRegistrationService {
  constructor() {
    this.driver = null;
    this.progressCallback = null;
    this.userDataDir = null;
  }
  
  // Set progress callback for real-time updates
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }
  
  // Send progress update
  sendProgress(step, message, percentage = null) {
    if (this.progressCallback) {
      this.progressCallback({
        step,
        message,
        percentage,
        timestamp: new Date().toISOString()
      });
    }
  }

  async isElementUsable(element) {
    try {
      return (await element.isDisplayed()) && (await element.isEnabled());
    } catch {
      return false;
    }
  }

  async waitForFirstVisible(locators, timeoutMs, label) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;

    while (Date.now() < deadline) {
      for (const locator of locators) {
        try {
          const elements = await this.driver.findElements(locator);
          for (const element of elements) {
            if (await this.isElementUsable(element)) {
              return element;
            }
          }
        } catch (error) {
          lastError = error;
        }
      }
      await this.driver.sleep(250);
    }

    throw new Error(`Could not find ${label} field (${lastError?.message || 'timeout'})`);
  }

  async resolveSteamLoginFields() {
    try {
      const usernameField = await this.waitForFirstVisible(
        STEAM_LOGIN_USERNAME_LOCATORS,
        20000,
        'username'
      );
      const passwordField = await this.waitForFirstVisible(
        STEAM_LOGIN_PASSWORD_LOCATORS,
        10000,
        'password'
      );
      const signInButton = await this.waitForFirstVisible(
        STEAM_LOGIN_SUBMIT_LOCATORS,
        10000,
        'sign in'
      );
      return { usernameField, passwordField, signInButton };
    } catch (primaryError) {
      console.log('Steam login locator fallbacks failed, using in-page discovery:', primaryError.message);
      const [usernameField, passwordField, signInButton] = await this.driver.executeScript(
        STEAM_LOGIN_DISCOVERY_SCRIPT
      );

      if (!usernameField || !passwordField || !signInButton) {
        throw new Error('Could not locate Steam login form fields on the page.');
      }

      return { usernameField, passwordField, signInButton };
    }
  }

  async waitForSteamLoginPage() {
    await this.driver.wait(async (driver) => {
      const url = await driver.getCurrentUrl();
      const title = await driver.getTitle();
      const onSteamHost = /steampowered\.com|steamcommunity\.com/i.test(url);
      const onLoginPage = /sign in/i.test(title) || url.includes('/login');
      return onSteamHost && onLoginPage;
    }, 20000, 'Expected Steam sign-in page');

    await this.driver.wait(async () => {
      try {
        await this.resolveSteamLoginFields();
        return true;
      } catch {
        return false;
      }
    }, 20000, 'Expected Steam login form to be ready');
  }

  async fillInputValue(field, value) {
    await field.clear();
    await field.sendKeys(value);
  }

  async clickElement(element) {
    await this.driver.executeScript('arguments[0].scrollIntoView({block: "center"});', element);
    await this.driver.sleep(200);
    try {
      await element.click();
    } catch {
      await this.driver.executeScript('arguments[0].click();', element);
    }
  }

  async checkSteamLoginErrors() {
    await this.driver.sleep(500);
    const pageText = await this.driver.executeScript(
      'return (document.body && (document.body.innerText || document.body.textContent)) || "";'
    );
    const normalized = String(pageText).toLowerCase();

    if (normalized.includes('too many retries')) {
      throw new Error('Steam rate limiting: Too many sign-in attempts. Please wait and try again later.');
    }

    if (
      normalized.includes('please check your password and account name') ||
      normalized.includes('please check your password') ||
      normalized.includes('incorrect login')
    ) {
      throw new Error('Invalid Steam credentials. Please check your username and password.');
    }
  }

  getMobileApprovalWaitMs() {
    const raw = process.env.STEAM_MOBILE_APPROVAL_WAIT_MS;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 120000;
  }

  async hasSteamMobileVerificationSignals() {
    return this.driver.executeScript(`
      const norm = (value) => (value || '').trim().toLowerCase();
      if (document.querySelector('#twofactorcode_entry, .twofactorauthcode_entry_input, #login_twofactor_authcode_entry')) {
        return true;
      }
      const pageText = norm(document.body ? document.body.innerText : '');
      return (
        pageText.includes('use the steam mobile app to confirm') ||
        pageText.includes('approve your sign in') ||
        pageText.includes('mobile authenticator protecting this account') ||
        pageText.includes('enter a code instead') ||
        pageText.includes('steam guard mobile authenticator')
      );
    `);
  }

  async isMobileAuthenticatorApprovalPage() {
    const url = await this.driver.getCurrentUrl();
    const onStoreLogin = /store\.steampowered\.com\/login/i.test(url);
    if (!onStoreLogin) {
      return false;
    }
    return this.hasSteamMobileVerificationSignals();
  }

  /** Wait until the store login mobile-approval UI appears, or auth has already moved past 2FA. */
  async waitForMobileAuthenticatorApprovalPage(timeoutMs = 45000) {
    console.log(`Waiting up to ${Math.round(timeoutMs / 1000)}s for Steam Mobile approval screen...`);
    this.sendProgress(3, 'Waiting for Steam Mobile App prompt...', 72);

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await this.handleAlertIfPresent();

      if (await this.isRustPlusTokenPage()) {
        console.log('Already on Rust+ token page (skipped mobile wait).');
        return 'completed';
      }

      const currentUrl = await this.driver.getCurrentUrl();
      if (await this.isOpenIdConsentPage() || isSteamOpenIdConsentUrl(currentUrl)) {
        console.log('Already past mobile approval (OpenID consent).');
        return 'past';
      }

      if (await this.isMobileAuthenticatorApprovalPage()) {
        console.log('Steam Mobile approval screen is ready.');
        return 'ready';
      }

      if (/store\.steampowered\.com\/login/i.test(currentUrl)) {
        console.log('On Steam store login, waiting for mobile approval UI...');
      } else if (await this.hasSteamMobileVerificationSignals()) {
        console.log('2FA UI detected, waiting for store.steampowered.com/login...', currentUrl);
      }

      await this.driver.sleep(1000);
    }

    throw new Error(
      'Timed out waiting for the Steam Mobile App approval screen. Try again and approve the sign-in on your phone when prompted.'
    );
  }

  async isOpenIdConsentPage() {
    const url = await this.driver.getCurrentUrl();
    if (!isSteamOpenIdConsentUrl(url)) {
      return false;
    }

    return this.driver.executeScript(`
      return !!(
        document.querySelector('#imageLogin') ||
        document.querySelector('form#openidForm') ||
        (document.body && document.body.innerText.includes('Sign into companion-rust.facepunch.com'))
      );
    `);
  }

  async hasRustPlusTokenInPage() {
    return this.driver.executeScript(`
      const html = document.documentElement ? document.documentElement.innerHTML : '';
      return html.includes('postMessage') && html.includes('Token');
    `);
  }

  async isRustPlusTokenPage() {
    const url = await this.driver.getCurrentUrl();
    if (!isRustPlusPageUrl(url)) {
      return false;
    }
    return this.hasRustPlusTokenInPage();
  }

  async waitForRustPlusTokenPage(timeoutMs = 45000) {
    await this.driver.wait(async (driver) => {
      await this.handleAlertIfPresent();
      const url = await driver.getCurrentUrl();
      if (!isRustPlusPageUrl(url)) {
        return false;
      }
      return driver.executeScript(`
        const html = document.documentElement ? document.documentElement.innerHTML : '';
        return html.includes('postMessage') && html.includes('Token');
      `);
    }, timeoutMs, 'Expected Rust+ sign-in page with auth token');
  }

  async navigateFromLoginformToOpenId() {
    const url = await this.driver.getCurrentUrl();
    if (!isSteamLoginformUrl(url)) {
      return false;
    }

    const target = await this.driver.executeScript(`
      try {
        const goto = new URL(window.location.href).searchParams.get('goto');
        if (!goto) return null;
        if (goto.startsWith('http')) return goto;
        return window.location.origin + goto;
      } catch (e) {
        return null;
      }
    `);

    if (!target || !/\/openid\/login/i.test(target) || /loginform/i.test(target)) {
      return false;
    }

    console.log('Advancing from loginform to OpenID consent:', target);
    await this.driver.get(target);
    await this.driver.sleep(1500);
    return true;
  }

  async clickOpenIdConsentSignIn() {
    console.log('Clicking OpenID consent Sign In button...');
    const signInButton = await this.waitForFirstVisible(STEAM_OPENID_SIGN_IN_LOCATORS, 15000, 'OpenID Sign In');
    await this.clickElement(signInButton);

    try {
      await this.waitForRustPlusTokenPage(25000);
      return;
    } catch (navigationError) {
      const url = await this.driver.getCurrentUrl();
      if (!isSteamOpenIdConsentUrl(url)) {
        throw navigationError;
      }
      console.log('OpenID Sign In click did not redirect; submitting openidForm directly...');
    }

    await this.driver.executeScript(`
      const form = document.querySelector('#openidForm');
      if (form) {
        form.submit();
      }
    `);
    await this.waitForRustPlusTokenPage(25000);
  }

  async completePostAuthSteps() {
    this.sendProgress(3, 'Completing Steam authorization...', 82);
    const deadline = Date.now() + 60000;

    while (Date.now() < deadline) {
      await this.handleAlertIfPresent();

      const currentUrl = await this.driver.getCurrentUrl();
      console.log('Post-auth step, current URL:', currentUrl);

      if (await this.isRustPlusTokenPage()) {
        console.log('Rust+ token page is ready.');
        return;
      }

      if (isSteamLoginformUrl(currentUrl)) {
        const advanced = await this.navigateFromLoginformToOpenId();
        if (advanced) {
          continue;
        }
      }

      if (await this.isOpenIdConsentPage()) {
        await this.clickOpenIdConsentSignIn();
        return;
      }

      if (await this.isMobileAuthenticatorApprovalPage()) {
        await this.driver.sleep(2000);
        continue;
      }

      if (isSteamOpenIdConsentUrl(currentUrl)) {
        await this.clickOpenIdConsentSignIn();
        return;
      }

      await this.driver.sleep(1000);
    }

    const finalUrl = await this.driver.getCurrentUrl();
    if (!(await this.isRustPlusTokenPage())) {
      throw new Error(
        `Steam login did not complete. Expected Rust+ token page, but stayed on: ${finalUrl}`
      );
    }
  }

  async waitForMobileAuthenticatorApproval(timeoutMs = this.getMobileApprovalWaitMs()) {
    console.log(`Waiting up to ${Math.round(timeoutMs / 1000)}s for Steam Mobile App approval...`);
    this.sendProgress(3, 'Approve sign-in in the Steam Mobile App...', 78);

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const currentUrl = await this.driver.getCurrentUrl();

      if (await this.isRustPlusTokenPage()) {
        console.log('Mobile approval completed (Rust+ token page ready).');
        return;
      }

      const stillOnApprovalPage = await this.isMobileAuthenticatorApprovalPage();
      if (!stillOnApprovalPage) {
        console.log('Left Steam Mobile approval screen:', currentUrl);
        return;
      }

      await this.driver.sleep(2000);
    }

    throw new Error(
      'Timed out waiting for Steam Mobile App approval. Approve the sign-in on your phone and try again.'
    );
  }
  
  // Main method to register with FCM using Steam credentials
  async registerWithSteamCredentials(username, password) {
    try {
      console.log('Starting FCM registration process...');
      this.sendProgress(1, 'Starting FCM registration process...', 0);
      
      // Step 1: Get FCM credentials
      this.sendProgress(1, 'Obtaining FCM credentials...', 10);
      const fcmCredentials = await this.getFcmCredentials();
      console.log('FCM credentials obtained');
      this.sendProgress(1, 'FCM credentials obtained', 20);
      
      // Step 2: Get Expo push token
      this.sendProgress(2, 'Getting Expo push token...', 30);
      const expoPushToken = await this.getExpoPushToken(fcmCredentials.fcm.token);
      console.log('Expo push token obtained');
      this.sendProgress(2, 'Expo push token obtained', 40);
      
      // Step 3: Get Rust+ auth token using Selenium
      this.sendProgress(3, 'Starting Steam login process...', 50);
      const rustplusAuthToken = await this.getRustplusAuthToken(username, password);
      console.log('Rust+ auth token obtained');
      this.sendProgress(3, 'Rust+ auth token obtained', 80);
      
      // Step 4: Register with Rust+ API
      this.sendProgress(4, 'Registering with Rust+ API...', 90);
      await this.registerWithRustPlus(rustplusAuthToken, expoPushToken);
      console.log('Successfully registered with Rust+ API');
      this.sendProgress(4, 'Successfully registered with Rust+ API', 100);
      
      return {
        fcm_credentials: fcmCredentials,
        expo_push_token: expoPushToken,
        rustplus_auth_token: rustplusAuthToken
      };
      
    } catch (error) {
      console.error('FCM registration failed:', error);
      
      // Don't crash the service for FCM registration errors
      if (error.message.includes('SessionNotCreatedError')) {
        const os = require('os');
        const isWindows = os.platform() === 'win32';
        
        if (isWindows) {
          console.error('Chrome session creation failed on Windows - this may be due to Chrome compatibility issues or system resource constraints');
          throw new Error('FCM registration failed: Chrome session could not be created on Windows. Please ensure Chrome is properly installed and try again.');
        } else {
          console.error('Chrome session creation failed - this may be due to system resource constraints');
          throw new Error('FCM registration failed: Chrome session could not be created. Please try again later.');
        }
      }
      
      throw error;
    } finally {
      await this.cleanup();
    }
  }
  
  // Helper method to handle alerts that might appear at any time
  async handleAlertIfPresent() {
    try {
      const alert = await this.driver.switchTo().alert();
      const alertText = await alert.getText();
      console.log(`Alert detected: "${alertText}"`);
      await alert.accept();
      console.log('Successfully dismissed alert');
      return true;
    } catch (error) {
      // No alert present
      return false;
    }
  }

  // Gets FCM credentials using the push-receiver library
  async getFcmCredentials() {
    const apiKey = "AIzaSyB5y2y-Tzqb4-I4Qnlsh_9naYv_TD8pCvY";
    const projectId = "rust-companion-app";
    const gcmSenderId = "976529667804";
    const gmsAppId = "1:976529667804:android:d6f1ddeb4403b338fea619";
    const androidPackageName = "com.facepunch.rust.companion";
    const androidPackageCert = "E28D05345FB78A7A1A63D70F4A302DBF426CA5AD";
    
    return await AndroidFCM.register(apiKey, projectId, gcmSenderId, gmsAppId, androidPackageName, androidPackageCert);
  }
  
  // Gets Expo push token
  async getExpoPushToken(fcmToken) {
    const response = await axios.post('https://exp.host/--/api/v2/push/getExpoPushToken', {
      type: 'fcm',
      deviceId: uuidv4(),
      development: false,
      appId: 'com.facepunch.rust.companion',
      deviceToken: fcmToken,
      projectId: "49451aca-a822-41e6-ad59-955718d0ff9c",
    });
    return response.data.data.expoPushToken;
  }
  
  // Gets Rust+ auth token using Selenium automation
  async getRustplusAuthToken(username, password) {
    
    try {
      this.sendProgress(3, 'Initializing browser...', 50);
      
      
      // Initialize Chrome driver with minimal required options
      const chrome = require('selenium-webdriver/chrome');
      const options = new chrome.Options();
      const headless = isSeleniumHeadless();

      if (headless) {
        options.addArguments('--headless=new');
      }
      options.addArguments('--no-sandbox');
      options.addArguments('--disable-dev-shm-usage');
      options.addArguments('--disable-gpu');
      options.addArguments('--disable-web-security');
      options.addArguments('--disable-extensions');
      options.addArguments('--no-first-run');
      options.addArguments('--disable-default-apps');
      
      this.driver = new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
      
      // Set timeouts for better reliability
      await this.driver.manage().setTimeouts({
        implicit: 10000,    // 10 seconds for element finding
        pageLoad: 30000,   // 30 seconds for page loading
        script: 30000      // 30 seconds for script execution
      });
      
      // Set window size as shown in the Selenium test
      await this.driver.manage().window().setRect({ width: 1686, height: 880 });
      
      this.sendProgress(3, 'Navigating to Rust+ login page...', 55);
      // Navigate to Rust+ login page
      await this.driver.get('https://companion-rust.facepunch.com/login');
      
      this.sendProgress(3, 'Clicking Steam login button...', 60);
      // Wait for page to load and click the span element (Steam login button)
      const steamButton = await this.driver.wait(
        until.elementLocated(By.css('span')),
        10000
      );
      await steamButton.click();
      
      this.sendProgress(3, 'Waiting for Steam login page...', 65);
      await this.waitForSteamLoginPage();

      this.sendProgress(3, 'Entering Steam credentials...', 70);
      const { usernameField, passwordField, signInButton } = await this.resolveSteamLoginFields();

      await this.fillInputValue(usernameField, username);
      await this.fillInputValue(passwordField, password);
      await this.clickElement(signInButton);

      await this.checkSteamLoginErrors();

      // After submit: openid/loginform -> store.steampowered.com/login (2FA) or openid consent
      await this.driver.wait(async (driver) => {
        const url = await driver.getCurrentUrl();
        if (isRustPlusPageUrl(url)) return true;
        if (/store\.steampowered\.com\/login/i.test(url)) return true;
        if (/\/openid\/login(?!form)/i.test(url)) return true;
        try {
          return !!(await driver.executeScript(`
            return !!(
              document.querySelector('#twofactorcode_entry, .twofactorauthcode_entry_input') ||
              (document.body && document.body.innerText.toLowerCase().includes('steam mobile app'))
            );
          `));
        } catch {
          return false;
        }
      }, 20000, 'Expected Steam 2FA or authorization page after credentials');

      // Check if Steam is asking for 2FA BEFORE trying to click final sign-in button
      try {
        const needsTwoFactor =
          /store\.steampowered\.com\/login/i.test(await this.driver.getCurrentUrl()) ||
          (await this.hasSteamMobileVerificationSignals());

        if (!needsTwoFactor) {
          throw new Error('No 2FA prompt detected');
        }

        console.log('Steam Mobile approval required...');
        await this.handleTwoFactor();
        console.log('Steam Mobile approval completed, continuing with normal flow...');
        this.sendProgress(3, 'Steam Mobile approval completed', 80);
        await this.completePostAuthSteps();
      } catch (error) {
        // If element is not found within 3 seconds, assume no 2FA required
        if (
          error.message.includes('Steam Mobile App approval') ||
          error.message.includes('Steam account requires')
        ) {
          throw error;
        }
        if (error.message.includes('Steam login did not complete')) {
          throw error;
        }
        // Otherwise, continue with normal flow (no 2FA required)
        console.log('No 2FA required, continuing with normal flow...');
        await this.completePostAuthSteps();
      }
      
      let currentUrl = await this.driver.getCurrentUrl();
      console.log('Current URL after login:', currentUrl);

      if (!(await this.isRustPlusTokenPage())) {
        await this.completePostAuthSteps();
      }

      await this.waitForRustPlusTokenPage(45000);
      
      // Handle any alerts that might appear
      await this.handleAlertIfPresent();
      
      // Wait for page to load and execute JavaScript
      await this.driver.sleep(5000);
      
      // Handle any alerts that might appear during page load
      await this.handleAlertIfPresent();
      
      // Get the page source with alert handling
      let pageSource;
      let finalUrl;
      try {
        pageSource = await this.driver.getPageSource();
        finalUrl = await this.driver.getCurrentUrl();
        console.log('Final URL before token extraction:', finalUrl);
      } catch (error) {
        // If we get an alert error, handle it and try again
        if (error.message.includes('unexpected alert open')) {
          console.log('Alert detected during page source retrieval, handling...');
          await this.handleAlertIfPresent();
          // Try again after handling alert
          pageSource = await this.driver.getPageSource();
          finalUrl = await this.driver.getCurrentUrl();
          console.log('Final URL after alert handling:', finalUrl);
        } else {
          throw error;
        }
      }
      console.log('Page source length:', pageSource.length);
      
      if (!isRustPlusPageUrl(finalUrl)) {
        throw new Error(`Not on Rust+ site. Current URL: ${finalUrl}`);
      }

      if (!pageSource.includes('postMessage') || !pageSource.includes('Token')) {
        throw new Error(
          `On Rust+ but auth token was not emitted yet. Current URL: ${finalUrl}`
        );
      }

        // Extract token from page source
        if (pageSource.includes('postMessage') && pageSource.includes('Token')) {
          const scriptMatch = pageSource.match(/<script>[\s\S]*?postMessage\('([^']+)'\)[\s\S]*?<\/script>/);
          if (scriptMatch) {
            try {
              // Clean up and parse the JSON string
              let cleanJson = scriptMatch[1].trim().replace(/\\"/g, '"');
              const jsonData = JSON.parse(cleanJson);
              if (jsonData.Token) {
                console.log('Successfully extracted Rust+ auth token');
                return jsonData.Token;
              }
            } catch (e) {
              console.log('Failed to parse JSON from page source:', e);
            }
          }
        }
      
      throw new Error('Could not extract Rust+ auth token');
      
    } catch (error) {
      console.error('Error getting Rust+ auth token:', error);
      throw error;
    }
  }
  
  // Waits for Steam Mobile App sign-in approval, then continues the OpenID flow.
  async handleTwoFactor() {
    try {
      const state = await this.waitForMobileAuthenticatorApprovalPage(45000);

      if (state === 'completed' || state === 'past') {
        return;
      }

      await this.waitForMobileAuthenticatorApproval();
    } catch (error) {
      console.error('Error handling Steam Mobile approval:', error);
      throw error;
    }
  }
  
  // Registers with Rust+ API
  async registerWithRustPlus(authToken, expoPushToken) {
    return axios.post('https://companion-rust.facepunch.com:443/api/push/register', {
      AuthToken: authToken,
      DeviceId: 'rustplus.js',
      PushKind: 3,
      PushToken: expoPushToken,
    });
  }
  
  // Cleanup Selenium driver
  async cleanup() {
    if (this.driver) {
      try {
        await this.driver.quit();
      } catch (error) {
        console.error('Error closing driver:', error);
      }
      this.driver = null;
    }
  }
}

module.exports = FcmRegistrationService;
