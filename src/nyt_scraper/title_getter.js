import * as playwright from 'playwright'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const main = async () => {
    const browser = await playwright.chromium.launch({
        headless: true // setting this to true will not run the UI
    });
    const context = await browser.newContext();

    const linksFolderPath = path.join(__dirname, 'links');
    const linkFiles = fs.readdirSync(linksFolderPath);
    const outputPath = path.join(__dirname, "..", 'gpt_text_generator', "gpt2", "titles.txt");
    fs.writeFileSync(outputPath, ""); //first delete the previous ones

    // Loop through each link file
    for (const linkFile of linkFiles) {
        // Read URLs from the link file
        const date = linkFile.split('.')[0];
        const linkFilePath = path.join(linksFolderPath, linkFile);
        const urls = fs.readFileSync(linkFilePath, 'utf-8').split('\n');

        // Loop through each URL and scrape the article text
        for (const url of urls) {
            if (url !== '' && url.startsWith(`https://www.nytimes.com/${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6)}/`)) {
                const title = await getTitle(url, context);
                fs.appendFileSync(outputPath, title + '\n');
            }
        }
    }
    await context.close();
    await browser.close();
}

main()