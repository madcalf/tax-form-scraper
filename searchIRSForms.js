const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const formData = [];
const searchUrl =
  'https://apps.irs.gov/app/picklist/list/priorFormPublication.html?criteria=formNumber&value=[FORM_NAME]&submitSearch=Find';

const getFormData = async (productName) => {
  console.log('getting data for...', productName);
  const req = searchUrl.replace('[FORM_NAME]', productName);
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
};

// actual args start at index 2 of argv
const args = process.argv.slice(2);
process.argv.forEach((arg) => {
  getFormData(arg);
  // process.exitCode = 0;
});
