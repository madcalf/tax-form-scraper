const path = require('path');
const fs = require('fs-extra');
const { DownloaderHelper } = require('node-downloader-helper');
const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

// note this url w the pagination index (indexOfFirstRow) is
// not the url triggered by the Find button on the IRS
// search page. It's comes up when you hit any of the links
// for more results. But it works for the initial search if
// you use an index of 0. All the other params seem to be
// necessary, even tho we don't care about the sorting and
// such.
const searchUrl =
  'https://apps.irs.gov/app/picklist/list/priorFormPublication.html?indexOfFirstRow=[INDEX]&sortColumn=sortOrder&value=[FORM_NAME]&criteria=formNumber&resultsPerPage=25&isDescending=false';

const getPage = async (formName, offset) =>
  new Promise(async (resolve, reject) => {
    let url = searchUrl.replace('[FORM_NAME]', formName);
    url = url.replace('[INDEX]', offset);
    try {
      let { data } = await axios.get(url);
      const { document: htmlDoc } = new JSDOM(data).window;

      // check for errors before proceeding. Look for <p id="errorText">
      const errorText = htmlDoc.querySelector('p#errorText');
      if (errorText) {
        throw new Error(`No results found for '${formName}'`);
      }

      // get number of results returned and total results
      const { lastResult, totalResults } = getResultCount(htmlDoc);
      const formData = extractPdfLinks(htmlDoc, formName);

      resolve({ formData, lastResult, totalResults });
    } catch (e) {
      console.error(`Error! ${e.message}\n ${e.stack}`);
    }
  });

const searchForFormLinks = async (formName, offset = 0) => {
  const data = await getPage(formName, offset);
  if (data.lastResult < data.totalResults) {
    return data.formData.concat(
      await searchForFormLinks(formName, data.lastResult + 1)
    );
  } else {
    return data.formData;
  }
};

const getResultCount = (htmlDoc) => {
  const resultText = htmlDoc
    .querySelector('th[class=ShowByColumn]')
    .textContent.trim();
  const lastResult = parseInt(resultText.split('- ')[1].split(' of ')[0]);
  const totalResults = parseInt(
    resultText.split('- ')[1].split(' of ')[1].split(' ')[0]
  );
  return { lastResult, totalResults };
};

// Should this return a list of links or call a function to initiate the download directly?
const extractPdfLinks = (htmlDoc, formName) => {
  const tableRows = htmlDoc.querySelectorAll('table.picklist-dataTable tr');
  let arr = [];

  if (tableRows.length > 1) {
    tableRows.forEach((row, index) => {
      let obj = {};

      // note the first row is only the table headers and has no class name
      // rows with relevant data have a class name of 'odd' or 'even'.
      if (row.className === 'odd' || row.className === 'even') {
        const productName = row
          .querySelector('td[class=LeftCellSpacer]>a')
          .textContent.trim();

        // Only continue if productName is exactly the thing we searched
        if (productName === formName) {
          obj.form_name = productName;
          obj.url = row.querySelector('td[class=LeftCellSpacer] a').href;
          obj.year = obj.url.split('--')[1].split('.')[0];
          arr.push(obj);
        }
      }
    });
  }
  return arr;
};

const downloadTaxForms = async (formName, minYear, maxYear) => {
  // create directory for this form
  const filepath = path.join(__dirname, formName);
  fs.ensureDir(filepath);

  const results = await searchForFormLinks(formName);

  filteredResults = results.filter(({ year }) => {
    let yearInt = parseInt(year);
    return yearInt >= minYear && yearInt <= maxYear;
  });

  const promises = filteredResults.map(({ form_name, url, year }) => {
    const options = {
      fileName: `${form_name} - ${year}.pdf`,
      override: true,
    };
    const dl = new DownloaderHelper(url, filepath, options);
    dl.start();
    return dl;
  });

  Promise.all(promises).then((promise) => {
    console.log(`Downloaded ${promises.length} files to ${filepath}`);
  });
};

if (process.argv.length > 5) {
  console.error('Specify the [form Name] [minYear] [maxYear]');
} else {
  const [form, minyear, maxyear] = process.argv.slice(2, 5);
  downloadTaxForms(form, minyear, maxyear);
}
