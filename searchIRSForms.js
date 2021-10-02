const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const results = [];
const searchUrl =
  'https://apps.irs.gov/app/picklist/list/priorFormPublication.html?criteria=formNumber&value=[FORM_NAME]&submitSearch=Find';
//  'https://apps.irs.gov/app/picklist/list/priorFormPublication.html?resultsPerPage=100&sortColumn=sortOrder&indexOfFirstRow=0&criteria=formNumber&value=Form+1099&isDescending=false'
//  page 2?
//  'https://apps.irs.gov/app/picklist/list/priorFormPublication.html?indexOfFirstRow=25&sortColumn=sortOrder&value=Form+1040-EZ&criteria=formNumber&resultsPerPage=25&isDescending=false'

// Note not dealiing with pagination... yet...

const getFormData = async (formName) => {
  console.log('getting data for...', formName);
  const req = searchUrl.replace('[FORM_NAME]', formName);
  try {
    const { data } = await axios.get(req);
    const { document: doc } = new JSDOM(data).window;

    // check for errors before proceeding. Look for <p id="errorText">
    const error = doc.querySelector('p#errorText');
    if (error) {
      console.error('ERROR', `No results found for '${formName}'`);
    } else {
      console.log(`Results found for '${formName}'. Parsing results`);
      parseContent(doc, formName);
    }
  } catch (e) {
    console.error(e);
  }
};

const parseContent = (doc, formName) => {
  // parse the list of items in the html data into the required json format
  const tableRows = doc.querySelectorAll('table.picklist-dataTable tr');
  let obj = {};

  if (tableRows.length > 1) {
    tableRows.forEach((row, index) => {
      // note the first row is only the table headers and has no class name
      // rows with relevant data have a class name of 'odd' or 'even'.
      if (row.className === 'odd' || row.className === 'even') {
        const productName = row
          .querySelector('td[class=LeftCellSpacer]>a')
          .textContent.trim();

        // If productName is not exactly the thing we searched, don't continue
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
        } else {
          // console.error`This product (${productName}) does not match the search term (${formName})`();
        }
      }
    });
  }
  if (Object.keys(obj).length > 0) {
    results.push(obj);
  }
  console.log(JSON.stringify(results));
  return JSON.stringify(results);
};

// actual args start at index 2 of argv
// pass args as one string of comma separated values. E.g 'Form 1040, Form-1099'.

// const args = process.argv.slice(2);
const args = process.argv[2].split(',');
args.forEach((arg) => {
  getFormData(arg.trim());
});
