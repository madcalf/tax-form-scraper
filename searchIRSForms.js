const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const formData = [];
const searchUrl =
  'https://apps.irs.gov/app/picklist/list/priorFormPublication.html?criteria=formNumber&value=[FORM_NAME]&submitSearch=Find';

//  'https://apps.irs.gov/app/picklist/list/priorFormPublication.html?resultsPerPage=100&sortColumn=sortOrder&indexOfFirstRow=0&criteria=formNumber&value=Form+1099&isDescending=false'

//  page 2?
//  'https://apps.irs.gov/app/picklist/list/priorFormPublication.html?indexOfFirstRow=25&sortColumn=sortOrder&value=Form+1040-EZ&criteria=formNumber&resultsPerPage=25&isDescending=false'

const getFormData = async (productName) => {
  console.log('getting data for...', productName);
  const req = searchUrl.replace('[FORM_NAME]', productName);
  try {
    const { data } = await axios.get(req);

    // need to check for error cases - e.g. no items found,
    // parse the list of items in the html data into the required json format

    const { document: doc } = new JSDOM(data).window;
    const tableRows = doc.querySelectorAll('table.picklist-dataTable tr');

    console.log(tableRows, tableRows.length);

    if (tableRows.length > 1) {
      tableRows.forEach((row) => {
        // note the first row is headers and doesn't have any data we care about
        const productName = doc
          .querySelector('td[class=LeftCellSpacer]>a')
          .textContent.trim();

        const title = doc
          .querySelector('td[class="MiddleCellSpacer')
          .textContent.trim();

        const year = doc
          .querySelector('td[class="EndCellSpacer')
          .textContent.trim();

        console.log('product', productName);
        console.log('title', title, 'year', year);
      });
    }
  } catch (e) {
    console.error(e);
  }
};

// actual args start at index 2 of argv
// pass args as one string of comma separated values. E.g 'Form 1040, Form-1099'.

// const args = process.argv.slice(2);
const args = process.argv[2].split(',');
console.log('args', args);
args.forEach((arg) => {
  getFormData(arg.trim());
  // process.exitCode = 0;
});
