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
      const formData = extractItemsFromResults(htmlDoc, formName);

      resolve({ formData, lastResult, totalResults });
    } catch (e) {
      console.error(`Error! ${e.message}\n ${e.stack}`);
    }
  });

const searchForForm = (formName, offset = 0) => {
  return getPage(formName, offset).then((data) => {
    if (data.lastResult < data.totalResults) {
      return searchForForm(formName, data.lastResult + 1).then(
        (nextFormData) => {
          const allForms = data.formData.concat(nextFormData);
          return allForms;
        }
      );
    } else {
      return data.formData;
    }
  });
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

// adds each matching form to our list as {name, title, year}.
// list will collect all matching forms from all pages
const extractItemsFromResults = (htmlDoc, formName) => {
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
          obj.form_title = row
            .querySelector('td[class=MiddleCellSpacer]')
            .textContent.trim();

          obj.year = row
            .querySelector('td[class=EndCellSpacer]')
            .textContent.trim();

          arr.push(obj);
        }
      }
    });
  }
  return arr;
};

// takes array of all the found instances of a form and
// returns a summary object: {formName, title, min_year,
// max_year}
const summarizeFormData = (formData) => {
  // console.log('summarizeFormData', formData?.length);
  const obj = {
    form_name: null,
    form_title: null,
    min_year: null,
    max_year: null,
  };
  formData.forEach((o) => {
    if (Object.keys(o).length) {
      const { form_name, form_title, year } = o;

      obj.form_name = form_name;
      obj.form_title = form_title;
      obj.min_year = !obj.min_year || year < obj.min_year ? year : obj.min_year;
      obj.max_year = !obj.max_year || year > obj.max_year ? year : obj.max_year;
    }
  });
  return obj;
};

const getTaxFormData = (args) => {
  const promises = args.map((arg) =>
    searchForForm(arg.trim()).then((results) => {
      return summarizeFormData(results);
    })
  );

  Promise.all(promises).then((formSummaries) => {
    process.stdout.write(`${JSON.stringify(formSummaries.flat())}\n`);
  });
};

// Note args passed in from commandline start at index 2 of
// argv. Expecting args as one string of comma separated
// values. E.g 'Form 1040, Form-1099'.
if (process.argv.length > 3) {
  console.error('Please specify a single string with comma separated values');
} else {
  const args = process.argv[2].split(',');
  getTaxFormData(args);
}
