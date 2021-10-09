const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
let results = []; // right now this is the results for one form, which is problematic
let allForms = []; //
const searchUrl =
  'https://apps.irs.gov/app/picklist/list/priorFormPublication.html?criteria=formNumber&value=[FORM_NAME]&submitSearch=Find';
const paginatedUrl =
  'https://apps.irs.gov/app/picklist/list/priorFormPublication.html?indexOfFirstRow=[INDEX]&sortColumn=sortOrder&value=[FORM_NAME]&criteria=formNumber&resultsPerPage=25&isDescending=false';

let lastResult, totalResults;

const getPage = async (formName, offset) =>
  new Promise(async (resolve, reject) => {
    console.log(`getting ${formName} data at offset ${offset}`);

    let url = paginatedUrl.replace('[FORM_NAME]', formName);
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
      console.log('formData from getPage', formData.length);
      resolve({ formData, lastResult, totalResults });
    } catch (e) {
      console.error(`Error! ${e.message}\n ${e.stack}`);
    }
  });

let temp = [];
const searchForForm = async (formName, offset = 0) => {
  console.log(`Searching for form ${formName}...`);

  return getPage(formName, offset).then((data) => {
    console.log('formData from Search', data.formData.length);
    if (data.lastResult < data.totalResults) {
      return searchForForm(formName, data.lastResult + 1).then((data2) => {
        console.log('data2', data2);
        return data.formData.concat(data2);
        // return data; // data.formData.concat(data2.formData);
      });
    } else {
      console.log('data.formData', data.formData.length);
      return data.formData;
    }
  });

  // const req = url.replace('[FORM_NAME]', formName);
  // try {
  //   let { data } = await axios.get(req);
  //   const { document: htmlDoc } = new JSDOM(data).window;
  //   // check for errors before proceeding. Look for <p id="errorText">
  //   const error = htmlDoc.querySelector('p#errorText');
  //   if (error) {
  //     console.error(`No results found for '${formName}'`);
  //   } else {
  //     const getItems = async () => {};
  //     ({ lastResult, totalResults } = getResultCount(htmlDoc));
  //     const extractedItems = extractItemsFromResults(htmlDoc, formName);
  //     results = [...results, ...extractedItems];

  //     // if there are additional pages, check them too
  //     while (lastResult < totalResults) {
  //       let newUrl = paginatedUrl.replace('[FORM_NAME]', formName);
  //       newUrl = newUrl.replace('[INDEX]', lastResult + 1);
  //       await searchForForm(formName, newUrl);
  //     }

  //     if (Object.keys(extractedItems).length === 0) {
  //       console.error(`No results match the specific form name '${formName}'`);
  //     }
  //   }
  // } catch (e) {
  //   console.error('Error!', e.message, e.stack);
  // }
  // return results;
};

// const searchForForm = async (formName, url = searchUrl) => {
//   console.log('getting data for...', formName);
//   const req = url.replace('[FORM_NAME]', formName);
//   try {
//     let { data } = await axios.get(req);
//     const { document: htmlDoc } = new JSDOM(data).window;
//     // check for errors before proceeding. Look for <p id="errorText">
//     const error = htmlDoc.querySelector('p#errorText');
//     if (error) {
//       console.error(`No results found for '${formName}'`);
//     } else {
//       ({ lastResult, totalResults } = getResultCount(htmlDoc)); // prob don't need totalResults here if you delcare it above?
//       const extractedItems = extractItemsFromResults(htmlDoc, formName);
//       results = [...results, ...extractedItems];

//       // if there are additional pages, check them too
//       while (lastResult < totalResults) {
//         let newUrl = paginatedUrl.replace('[FORM_NAME]', formName);
//         newUrl = newUrl.replace('[INDEX]', lastResult + 1);
//         await searchForForm(formName, newUrl);
//       }

//       if (Object.keys(extractedItems).length === 0) {
//         console.error(`No results match the specific form name '${formName}'`);
//       }
//     }
//   } catch (e) {
//     console.error('Error!', e.message, e.stack);
//   }
//   return results;
// };

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
  // console.log('arr', arr);
  return arr;
};

const processResultsToJSON = (formData) => {
  console.log('processJSON', formData?.length);
  const obj = {
    form_name: null,
    form_title: null,
    min_year: null,
    max_year: null,
  };
  formData.forEach((o) => {
    if (Object.keys(o).length) {
      const { form_name, form_title, year } = o;
      // console.log(form_name, form_title, year);
      obj.form_name = form_name;
      obj.form_title = form_title;
      obj.min_year = !obj.min_year || year < obj.min_year ? year : obj.min_year;
      obj.max_year = !obj.max_year || year > obj.max_year ? year : obj.max_year;
    }
  });
  // return JSON.stringify(obj);
  return obj;
};

// // parse the list of items in the html data into the required json format
// const parseSearchResults = (htmlDoc, formName, obj) => {
//   const tableRows = htmlDoc.querySelectorAll('table.picklist-dataTable tr');
//   // let obj = {};

//   if (tableRows.length > 1) {
//     tableRows.forEach((row, index) => {
//       // note the first row is only the table headers and has no class name
//       // rows with relevant data have a class name of 'odd' or 'even'.
//       if (row.className === 'odd' || row.className === 'even') {
//         const productName = row
//           .querySelector('td[class=LeftCellSpacer]>a')
//           .textContent.trim();

//         // Only continue if productName is exactly the thing we searched
//         if (productName === formName) {
//           obj.form_name = productName;
//           obj.form_title = row
//             .querySelector('td[class=MiddleCellSpacer]')
//             .textContent.trim();

//           const year = row
//             .querySelector('td[class=EndCellSpacer]')
//             .textContent.trim();

//           if (!obj.max_year || year > obj.max_year) obj.max_year = year;
//           if (!obj.min_year || year < obj.min_year) obj.min_year = year;
//         }
//       }
//     });
//   }
//   return obj;
// };

const getTaxFormData = async (args) => {
  return searchForForm(args[0].trim()).then((results) =>
    console.log('results', results?.length)
  );

  // let promises = [];
  // args.forEach(async (arg) => {
  //   await searchForForm(arg.trim());
  //   // promises.push(searchForForm(arg.trim()));
  // });

  // await Promise.all(promises);
  // console.log('promises', promises);

  // note each item in promises represents the data for 1 form. E.g. 1040-A
  // const promises = args.map((arg) => searchForForm(arg.trim()));
  // await Promise.all(promises);

  // console.log('promises', promises.length);

  // await promises.forEach(async (p, index) => {
  //   const formData = await p;
  //   // console.log('formData', formData.length, index);

  //   if (formData && Object.keys(formData).length) {
  //     console.log('When is this happening?', formData);
  //     const jsonObj = processResultsToJSON(formData);
  //     // console.log('jsonObj', jsonObj);
  //     allForms.push(jsonObj);
  //   }
  // });
  // console.log(allForms);

  // await promises.forEach(async (p) => {
  //   const val = await p;
  //   console.log('val', val.length, val);
  //   if (val && Object.keys(val).length) {
  //     results.push(val);
  //   }
  // });

  // process.stdout.write(`${processResultsToJSON()}\n`);
  process.stdout.write(`${allForms}\n`);
};

// Note args passed in start at index 2 of argv
// Expecting args as one string of comma separated values. E.g 'Form 1040, Form-1099'.
if (process.argv.length > 3) {
  console.error('Please specify a single string with comma separated values');
} else {
  const args = process.argv[2].split(',');
  getTaxFormData(args);
}
