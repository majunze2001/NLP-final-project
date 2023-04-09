import * as playwright from 'playwright'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const login = async (page) => {
    await page.goto('https://www.nytimes.com/');
    await page.click('.css-ni9it0.e1j3jvdr0');

    await page.waitForSelector('input[name="email"]');
    await page.fill('input[name="email"]', 'majunze2001@gmail.com');

    await page.waitForSelector('[data-testid="submit-email"]');
    await page.click('[data-testid="submit-email"]');

    await page.waitForSelector('input[name="password"]');
    await page.fill('input[name="password"]', 'Mjz010827');
    await page.click('[data-testid="login-button"]');

    await page.waitForSelector('[data-testid="user-settings-button"]');
    console.log('Logged in to New York Times');
}

const scrapeText = async (url, context, date, counter) => {
    const page = await context.newPage();
    await page.goto(url);
    const paragraphs = await page.$$('p.css-at9mc1.evys1bk0');

    const textArray = [];

    // loop through the p elements and add their text to the array
    for (const p of paragraphs) {
        const paragraphText = await p.innerText();
        textArray.push(paragraphText);
    }

    // join the array pieces together into a single string
    const articleText = textArray.join('\n');
    console.log(`Article text for ${date} ${counter}:`, articleText.length);

    // create the data folder if it doesn't exist
    if (!fs.existsSync('data')) {
        fs.mkdirSync('data');
    }

    // save the article text to a file
    const fileName = `${date}_${counter}.txt`;
    await page.close();
    fs.writeFileSync(`data/${fileName}`, articleText);
}

const main = async () => {
    const browser = await playwright.chromium.launch({
        headless: true // setting this to true will not run the UI
    });
    const context = await browser.newContext();
    // const loginPage = await context.newPage();
    // await login(loginPage);

    // await scrapeText("https://www.nytimes.com/2021/01/01/us/politics/iran-trump.html?searchResultPosition=1",
    //     context, 20210101, 1)

    const linksFolderPath = path.join(__dirname, 'links');
    const linkFiles = fs.readdirSync(linksFolderPath);

    // Loop through each link file
    for (const linkFile of linkFiles) {
        // Read URLs from the link file
        const date = linkFile.split('.')[0];
        const linkFilePath = path.join(linksFolderPath, linkFile);
        const urls = fs.readFileSync(linkFilePath, 'utf-8').split('\n');

        // Loop through each URL and scrape the article text
        let counter = 0;
        for (const url of urls) {
            if (url !== '' && url.startsWith(`https://www.nytimes.com/${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6)}/`)) {
                counter++;
                try {
                    await scrapeText(url, context, date, counter);
                } catch (err) {
                    console.log(`Error scraping article: ${url}`);
                    console.error(err);
                }
            }
        }
        console.log(date, counter);
    }


    await context.close();
    await browser.close();
}


main()