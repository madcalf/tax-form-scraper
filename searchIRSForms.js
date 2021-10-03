const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
let results = [];
const searchUrl =
  'https://apps.irs.gov/app/picklist/list/priorFormPublication.html?criteria=formNumber&value=[FORM_NAME]&submitSearch=Find';

// Note not dealiing with pagination... yet... But here's some searches that may help that process
//  'https://apps.irs.gov/app/picklist/list/priorFormPublication.html?resultsPerPage=100&sortColumn=sortOrder&indexOfFirstRow=0&criteria=formNumber&value=Form+1099&isDescending=false'
//  'https://apps.irs.gov/app/picklist/list/priorFormPublication.html?indexOfFirstRow=25&sortColumn=sortOrder&value=Form+1040-EZ&criteria=formNumber&resultsPerPage=25&isDescending=false'

const searchForForm = async (formName) => {
  console.log('getting data for...', formName);
  const req = searchUrl.replace('[FORM_NAME]', formName);
  let result;
  try {
    const { data } = await axios.get(req);
    const { document: htmlDoc } = new JSDOM(data).window;

    // check for errors before proceeding. Look for <p id="errorText">
    const error = htmlDoc.querySelector('p#errorText');
    if (error) {
      console.error(`No results found for '${formName}'`);
    } else {
      result = parseSearchResults(htmlDoc, formName);
      if (Object.keys(result).length === 0) {
        console.error(`No results match the specific form name '${formName}'`);
      }
      return result;
    }
  } catch (e) {
    console.error('ERROR!', e.message);
  }
};

// parse the list of items in the html data into the required json format
const parseSearchResults = (htmlDoc, formName) => {
  const tableRows = htmlDoc.querySelectorAll('table.picklist-dataTable tr');
  let obj = {};

  if (tableRows.length > 1) {
    tableRows.forEach((row, index) => {
      // note the first row is only the table headers and has no class name
      // rows with relevant data have a class name of 'odd' or 'even'.
      if (row.className === 'odd' || row.className === 'even') {
        const productName = row
          .querySelector('td[class=LeftCellSpacer]>a')
          .textContent.trim();

        // Only continue if productName is exactly the thing we searched
        if (productName === formName) {
          obj.form_name = productName;
          obj.form_title = row
            .querySelector('td[class=MiddleCellSpacer]')
            .textContent.trim();

          const year = row
            .querySelector('td[class=EndCellSpacer]')
            .textContent.trim();

          if (!obj.max_year || year > obj.max_year) obj.max_year = year;
          if (!obj.min_year || year < obj.min_year) obj.min_year = year;
        }
      }
    });
  }
  return obj;
};

const getTaxFormData = async (args) => {
  const promises = args.map((arg) => searchForForm(arg.trim()));
  await Promise.all(promises);

  await promises.forEach(async (p) => {
    const val = await p;
    if (val && Object.keys(val).length) {
      results.push(val);
    }
  });

  process.stdout.write(`${JSON.stringify(results)}\n`);
};

// Note args passed in start at index 2 of argv
// Expecting args as one string of comma separated values. E.g 'Form 1040, Form-1099'.
if (process.argv.length > 3) {
  console.error('Please specify a single string with comma separated values');
} else {
  const args = process.argv[2].split(',');
  getTaxFormData(args);
}
