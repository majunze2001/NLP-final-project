import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config()
import * as playwright from 'playwright'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cookie_file = 'cookies.json';
const next_day = '20200000';
const next_count = 0;

const login = async (browserContext) => {
    const cookie_data = fs.readFileSync(path.join(__dirname, cookie_file),
        { encoding: 'utf8', flag: 'r' });
    if (cookie_data) {
        const prev_cookies = JSON.parse(cookie_data).cookies
        await browserContext.addCookies([cookieObject1, cookieObject2]);
        console.log(prev_cookies);
        return;
    }

    // do log in here
    const page = await browserContext.newPage();
    await page.goto('https://chat.openai.com/');

    await page.evaluate(() => window.localStorage.removeItem(Object.keys(window.localStorage).find(i => i.startsWith('@@auth0spajs'))));


    // log in btn
    await page.waitForSelector('.btn.relative.btn-primary');
    await page.click('.btn.relative.btn-primary');

    // email
    await page.waitForSelector('[inputmode="email"]');
    await page.fill('[inputmode="email"]', process.env.OPENAI_EMAIL);

    // submit email
    await page.waitForSelector('button[type="submit"]');
    await page.click('button[type="submit"]');

    // password
    await page.waitForSelector('input[type="password"]');
    await page.fill('input[type="password"]', process.env.OPENAI_PASSWORD);

    // submit email
    await page.waitForSelector('button[type="submit"]');
    await page.click('button[type="submit"]');

    // load 
    await page.waitForSelector('textarea');

    const cookies = await browserContext.cookies();

    // save the cookies for next time
    fs.writeFileSync(path.join(__dirname, cookie_file), JSON.stringify({ 'cookies': cookies }), 'utf8');
    console.log('Logged in to OpenAI');

    await page.close();
}

const getTitle = async (url, context) => {
    const page = await context.newPage();
    await page.goto(url);
    const title = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        return h1 ? h1.textContent.trim() : '';
    });
    if (title.length === 0){
        console.log(url);
    }
    await page.close();
    return title;
}

const scrapeText = async (url, context, date, counter, title) => {
    const page = await context.newPage();
    await page.goto(url);

    await page.waitForTimeout(2000); // wait for some time

    // prompt input
    const prompt = `Generate and article with title "${title}"`;
    await page.waitForSelector('.textarea textarea');
    await page.fill('.textarea textarea', prompt);

    // submit
    await page.click('.el-icon-s-promotion')

    // we wait for 2 seconds
    await page.waitForTimeout(2000); 
    // wait to generate response
    await page.waitForSelector('.el-icon-s-promotion')
    
    const response = await page.evaluate(() => {
        const responseEl = document.querySelector('.v-show-content.scroll-style.scroll-style-border-radius');
        return responseEl ? responseEl.textContent.trim() : '';
    });

    // create the data folder if it doesn't exist
    if (!fs.existsSync('data')) {
        fs.mkdirSync('data');
    }

    console.log(`Article text for ${date}_${counter} -- ${title}:`, response.length);

    if (response.length){
        // save the article text to a file
        const fileName = `${date}_${counter}.txt`;
        await page.close();
        fs.writeFileSync(`data/${fileName}`, response);
        await new Promise((resolve) => setTimeout(resolve, 10000 + Math.floor(Math.random() * 10000)));
    }
}



const main = async () => {
    const browser = await playwright.chromium.launch({
        headless: true // setting this to true will not run the UI
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    let context = await browser.newContext();
    context.setDefaultTimeout(60000);
    // await login(browser);

    // gpt is too powerful so we use proxy
    const linksFolderPath = path.join(__dirname, "..", "nyt_scraper", 'links');
    const linkFiles = fs.readdirSync(linksFolderPath);

    // Loop through each link file
    for (const linkFile of linkFiles) {
        // Read URLs from the link file
        const date = linkFile.split('.')[0];
        if (date < next_day) {
            continue;
        }
        const linkFilePath = path.join(linksFolderPath, linkFile);
        const urls = fs.readFileSync(linkFilePath, 'utf-8').split('\n');
        // Loop through each URL and scrape the article text
        let counter = 0;
        for (const url of urls) {
            if (url !== '' && url.startsWith(`https://www.nytimes.com/${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6)}/`)) {
                counter++;
                if (date == next_day && counter < next_count) {
                    continue;
                }
                const fileName = `${date}_${counter}.txt`;
                if (fs.existsSync(`data/${fileName}`)) {
                    console.log(`${fileName} exists`);
                    continue;
                }
                try {
                    const title = await getTitle(url, context);
                    if (title !== ""){
                        await scrapeText("https://chatgptproxy.me/#/", context, date, counter, title);
                    }
                } catch (err) {
                    console.log(`Error generating article: ${url}`);
                    console.error(err);
                    await context.close();
                    context = await browser.newContext();
                    context.setDefaultTimeout(60000);
                    await new Promise((resolve) => setTimeout(resolve, 20000));
                }
            }
        }
        console.log(date, counter);
    }

    await context.close();
    await browser.close();
}


main()