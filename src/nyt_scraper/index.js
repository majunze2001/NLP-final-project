import * as playwright from 'playwright'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { count } from 'console';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const main = async () => {
    const browser = await playwright.chromium.launch({
        headless: true // setting this to true will not run the UI
    });
    const context = await browser.newContext();

    const scrapeLinks = async (dateString) => {
        const page = await context.newPage();
        await page.goto(`https://www.nytimes.com/search?dropmab=false&endDate=${dateString}&query=&sort=best&startDate=${dateString}&types=article`);

        // Wait for the search results to load
        await page.waitForSelector('[data-testid="search-results"]');

        const searchButtons = await page.$$('button.css-4d08fs[data-testid="search-multiselect-button"]');
        await searchButtons[1].click();
        const totalNum = await page.$eval('.css-17fq56o', element => element.textContent);
        console.log(totalNum);
        await searchButtons[1].click();

        await page.waitForTimeout(3000);
        for (let i = 0; i < totalNum / 10; i++) {
            // Click the "Show More" button
            const showMoreButton = await page.$('[data-testid="search-show-more-button"]');
            if (showMoreButton) {
                await showMoreButton.click();
                // Wait for new search results to load
                await page.waitForSelector('[data-testid="search-results"] li:last-child');
            }
            await page.waitForTimeout(1000);
        }

        // Extract the links
        // const links = await page.$$eval(
        //     '[data-testid="search-results"] li.css-1l4w6pd[data-testid="search-bodega-result"] div.css-1i8vfl5 div.css-e1lvw9 a',
        //     (elements) => elements.map((element) => element.href)
        // );
        const links = await page.$$eval(
            '.css-e1lvw9 a',
            (elements) => elements.map((element) => element.href)
        );

        // Filter the links to only include those that match the corresponding date format
        const matchingLinks = links.filter((link, index) => {
            return link.startsWith(`https://www.nytimes.com/${dateString.slice(0, 4)}/${dateString.slice(4, 6)}/${dateString.slice(6)}/`) && index < totalNum
        });

        // Write the links to a file for this URL
        const linksDir = path.join(__dirname, 'links');
        if (!fs.existsSync(linksDir)) {
            fs.mkdirSync(linksDir);
        }
        const urlFileName = `${dateString}.txt`;
        const urlFilePath = path.join(linksDir, urlFileName);
        fs.writeFileSync(urlFilePath, matchingLinks.join('\n'));

        await page.close()
        return matchingLinks
    }

    // Generate date strings for every day in 2020 and 2021
    const dateStrings = [];
    for (let year = 2020; year <= 2021; year++) {
        const maxMonth = 12;
        for (let month = 1; month <= maxMonth; month++) {
            const maxDay = new Date(year, month, 0).getDate(); // Get the number of days in this month
            for (let day = 1; day <= maxDay; day++) {
                const dateString = `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;
                dateStrings.push(dateString);
            }
        }
    }

    // Call the scrapeLinks function for each dateString
    for (const dateString of dateStrings) {
        const links = await scrapeLinks(dateString);
        console.log(`Links for ${dateString}:`, links.length);
    }


    await context.close();
    await browser.close();

}

main();