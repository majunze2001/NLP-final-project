import * as playwright from 'playwright'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const main = async () => {
    const browser = await playwright.chromium.launch({
        headless: true // setting this to true will not run the UI
    });
    let context = await browser.newContext();
    const MAX_RETRY = 10;

    const scrapeLinks = async (dateString) => {
        let retries = 0;
        while (retries < MAX_RETRY) {
            try {
                const page = await context.newPage();
                await page.goto(`https://www.nytimes.com/search?dropmab=false&endDate=${dateString}&query=&sort=best&startDate=${dateString}&types=article`);

                // Wait for the search results to load
                await page.waitForSelector('[data-testid="search-results"]');

                const searchButtons = await page.$$('button.css-4d08fs[data-testid="search-multiselect-button"]');
                await searchButtons[1].click();
                const totalNum = await page.$eval('.css-17fq56o', element => element.textContent);
                console.log(`${dateString} expected: `, totalNum);
                await searchButtons[1].click();

                let count = await page.$$eval('[data-testid="search-results"]', elements => elements.length);
                while (count < totalNum) {
                    // Click the "Show More" button
                    const showMoreButton = await page.$('[data-testid="search-show-more-button"]');
                    if (showMoreButton) {
                        await showMoreButton.click();
                        // Wait for the search results to load
                        await Promise.all([
                            page.waitForSelector('[data-testid="search-results"] li:last-child'),
                            page.waitForSelector('[data-testid="search-show-more-button"]'),
                        ]);
                    } else {
                        console.log("showMoreButton is gone ... at ", dateString, count);
                        break;
                    }
                    count = await page.$$eval('[data-testid="search-results"]', elements => elements.length);
                    await page.waitForTimeout(200);
                }

                // Extract the links
                const links = await page.$$eval(
                    '.css-e1lvw9 a',
                    (elements) => elements.map((element) => element.href)
                );

                // Filter the links to only include those that match the corresponding date format
                const matchingLinks = links.filter((link, index) => {
                    return link.startsWith(`https://www.nytimes.com/${dateString.slice(0, 4)}/${dateString.slice(4, 6)}/${dateString.slice(6)}/`) && index < totalNum
                });

                await page.close()
                return matchingLinks
            } catch (e) {
                retries++;
                console.error(e, "--retrying");
                await context.close();
                context = await browser.newContext();
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }
        }
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
    const updateLinks = async (dateString, links) => {
        // Write the links to a file for this URL
        const linksDir = path.join(__dirname, 'links');
        if (!fs.existsSync(linksDir)) {
            fs.mkdirSync(linksDir);
        }

        const urlFileName = `${dateString}.txt`;
        const urlFilePath = path.join(linksDir, urlFileName);
        if (fs.existsSync(urlFilePath)) {
            const existingLinks = fs.readFileSync(urlFilePath, 'utf8').split('\n').filter(Boolean);
            if (links.length > existingLinks.length) {
                fs.writeFileSync(urlFilePath, links.join('\n'));
                console.log(`Links for ${dateString}: ${existingLinks.length}->${links.length}`);
            }
        } else {
            fs.writeFileSync(urlFilePath, links.join('\n'));
            console.log(`Links for ${dateString}:`, links.length);
        }
    }

    // Call the scrapeLinks function for each dateString
    for (const dateString of dateStrings) {
        const links = await scrapeLinks(dateString);
        await updateLinks(dateString, links)
    }


    await context.close();
    await browser.close();

}

main();