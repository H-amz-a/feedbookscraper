import puppeteer from "puppeteer";
import ExcelJS from "exceljs";

async function scrapePage(page) {
    return await page.evaluate(() => {
        function select(element, query, property) {
            try {
                if (!property) return element.querySelector(query);
                return element.querySelector(query)[property];
            } catch (error) {
                return "";
            }
        }

        function selectAll(element, query, property) {
            try {
                if (!property) return element.querySelectorAll(query);
                return element.querySelectorAll(query)[property];
            } catch (error) {
                return [];
            }
        }
        const bookBrowser = select(document, ".browse__items");
        const booksDetails = [];
        const bookList = selectAll(bookBrowser, ".browse__item");
        // const bookTagsList =
        bookList.forEach((book) => {
            const genreList = selectAll(
                book,
                'a[data-post-hog="catalog-itemcard-pill-category"]'
            );
            const genres = [];
            genreList.forEach((genre) => genres.push(genre.textContent || ""));
            booksDetails.push({
                title: select(book, ".block__item-title", "textContent"),
                bookURL: select(book, ".block__item-title", "href"),
                subtitle: select(book, ".block__item-subtitle", "textContent"),
                price: select(book, ".block__item-price", "textContent"),
                author: select(book, ".block__item-author", "textContent"),
                imgUrl: select(book, ".b-item__cover > img", "src"),
                genres: genres,
            });
        });
        return booksDetails;
    });
}

async function makeSpreadsheet(fileName, dataList) {
    let workbook = new ExcelJS.Workbook();
    workbook.columns = [
        { header: "Title", key: "title" },
        { header: "Subtitle", key: "subtitle" },
        { header: "Author", key: "author" },
        { header: "Genres", key: "Genres" },
        { header: "Price", key: "price" },
        { header: "Image", key: "imgURL" },
    ];
    workbook.addWorksheet("BookInfo");
    let ws = workbook.getWorksheet("BookInfo");
    ws.addRow(["Title", "Subtitle", "Author", "Genres", "Price", "ImageUrl"]);
    dataList.forEach((book) => {
        ws.addRow([
            book.title,
            book.subtitle,
            book.author,
            book.genres.toString(),
            book.price,
            book.imgUrl,
        ]);
    });
    await workbook.xlsx.writeFile(`${fileName}.xlsx`);
}
async function feedBooksScraper(url, filename) {
    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    // Navigate the page to a URL
    await page.goto(url);
    console.log("Page Opened");
    // wait for page to finish loading
    await page.waitForNetworkIdle({ timeout: 0 });
    console.log("navigation finished :)");
    // scrape current page data
    let books = [];
    let nextPageButton = await page.$(
        `a[data-post-hog="catalog-changepage-next"]`,
        (el) => el
    );
    let currentPage = await page.$eval(
        ".pagination__item--active",
        (el) => el.textContent
    );
    console.log(nextPageButton);
    // Scrape Pages
    while (currentPage < 201 && nextPageButton) {
        currentPage = await page.$eval(
            ".pagination__item--active",
            (el) => el.textContent
        );
        nextPageButton = await page.$(
            `a[data-post-hog="catalog-changepage-next"]`,
            (el) => el
        );
        console.log(`Currently Scraping Page: ${currentPage}`);
        books.push(...(await scrapePage(page)));
        if (!nextPageButton) break;
        console.log("Progressing to new page!");
        await page.click('a[data-post-hog="catalog-changepage-next"]');
        await page.waitForNetworkIdle({ timeout: 0 });
        console.log("Arrived at new page!");
    }
    console.log(books);
    console.log("Finished scraping books!");

    // export findings as spreadsheet
    await makeSpreadsheet(filename, books);
    console.log("Data Outputted!");
    await browser.close();
}
feedBooksScraper("https://www.feedbooks.com/drm_free", "engMain");
