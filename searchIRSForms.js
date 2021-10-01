const axios = require('axios');
const formData = [];
// const searchUrl = "https://apps.irs.gov/app/picklist/list/priorFormPublication.html?criteria=formNumber&value=Form+1040-EZ&submitSearch=Find"
const searchUrl =
  'https://apps.irs.gov/app/picklist/list/priorFormPublication.html?criteria=formNumber&value=[FORM_NAME]&submitSearch=Find';

const getFormData = async (productName) => {
  console.log('getting data for...', productName);
  const req = searchUrl.replace('[FORM_NAME]', productName);
  const { data } = await axios.get(req);
  console.log(data);
};

process.argv.forEach((arg, index) => {
  // console.log(index, arg);
  if (index >= 2) {
    getFormData(arg);
  }
  // process.exitCode = 0;
});
