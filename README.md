Experimenting with web scraping in Node.js.
A friend was describing a coding challenge they had to do in python. I wanted to try it in javascript. These 2 scripts mine the IRS product search page for multiple years of available tax forms.

#### Task 1

##### getTaxformIinfo.js

Searches for forms on the IRS website search page and reports the form name, title and available date range in a JSON object.

#### Task 2

##### downloadTaxForm.js

Downloads all found instances of specified form within the specified year range. PDFs are downloaded to a directory that matches the form name, and are renamed to include form name and year.
