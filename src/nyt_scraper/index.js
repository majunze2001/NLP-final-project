import * as playwright from 'playwright'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const onlyUnique = (value, index, array) => array.indexOf(value) == index;
const APPEND_ONLY = false
const linksDir = path.join(__dirname, 'links');
if (!fs.existsSync(linksDir)) {
    fs.mkdirSync(linksDir);
}
const MAX_WAIT = 5

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
                page.setDefaultTimeout(30000);
                page.setDefaultNavigationTimeout(30000);
                await page.goto(`https://www.nytimes.com/search?dropmab=false&endDate=${dateString}&query=&sort=best&startDate=${dateString}&types=article`);

                // Wait for the search results to load
                await page.waitForSelector('[data-testid="search-results"]');

                const searchButtons = await page.$$('button.css-4d08fs[data-testid="search-multiselect-button"]');
                await searchButtons[1].click();
                const totalNum = await page.$eval('.css-17fq56o', element => parseInt(element.textContent));
                console.log(`${dateString} expected: `, totalNum);
                await searchButtons[1].click();

                let waitCount = 0;
                let count = await page.$$eval('.css-e1lvw9 a', elements => elements.length);
                while (count < totalNum - 5) {
                    // Click the "Show More" button
                    process.stdout.write(count+" ")
                    const showMoreButton = await page.$('[data-testid="search-show-more-button"]');
                    if (showMoreButton) {
                        process.stdout.write(" c ")
                        await showMoreButton.click();
                        // Wait for the search results to load
                        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                        await page.waitForSelector('[data-testid="search-results"] li:last-child')
                        await page.$('[data-testid="search-show-more-button"]');
                        let curCount = await page.$$eval('.css-e1lvw9 a', elements => elements.length);
                        let curWait = 0;
                        while (curCount === count && curWait <= 10 * 1000 / 200 ){
                            await page.waitForTimeout(200); // we wait for at most 5s   s
                            curCount = await page.$$eval('.css-e1lvw9 a', elements => elements.length);
                            curWait++
                        }
                        if (curCount === count){
                            throw new Error(`Time out, ${dateString} ${count}`)
                        }
                    } else {
                        console.log("no showmore button")
                        waitCount++
                        if (waitCount < MAX_WAIT) {
                            await page.waitForTimeout(1000);
                            continue
                        } else if (retries < MAX_RETRY - 2) {
                            throw new Error(`showMoreButton is gone ... at, ${dateString} ${count}`)
                        } else{
                            break
                        }
                    }
                    count = await page.$$eval('.css-e1lvw9 a', elements => elements.length);
                    await page.waitForTimeout(200);
                }
                console.log(count)

                // Extract the links
                const links = await page.$$eval(
                    '.css-e1lvw9 a',
                    (elements) => elements.map((element) => element.href.split('?')[0])
                );

                // Filter the links to only include those that match the corresponding date format
                const matchingLinks = links.filter((link, index) => {
                    return link.startsWith(`https://www.nytimes.com/${dateString.slice(0, 4)}/${dateString.slice(4, 6)}/${dateString.slice(6)}/`) && index < totalNum
                }).filter(onlyUnique);
                console.log(`Total Count: ${count}`);
                await page.close()
                return matchingLinks
            } catch (e) {
                retries++;
                console.error(e, "--retrying\n");
                await context.close();
                context = await browser.newContext();
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }
        }
        return []
    }

    // Generate date strings for every day in 2020 and 2021
    const dateStrings = [];
    for (let year = 2020; year <= 2020; year++) {
        const maxMonth = 12;
        for (let month = 1; month <= maxMonth; month++) {
            const maxDay = new Date(year, month, 0).getDate(); // Get the number of days in this month
            for (let day = 1; day <= maxDay; day++) {
                // if (year === 2020 && month <=3 && day <=25){
                //     continue;
                // }
                const dateString = `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;
                dateStrings.push(dateString);
            }
        }
    }
    const updateLinks = async (dateString, links) => {
        // Write the links to a file for this URL
        const urlFileName = `${dateString}.txt`;
        const urlFilePath = path.join(linksDir, urlFileName);
        if (APPEND_ONLY && fs.existsSync(urlFilePath)) {
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