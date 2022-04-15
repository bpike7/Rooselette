import { google } from 'googleapis';

const { BULLWISE_GOOGLE_CLIENT_EMAIL, BULLWISE_GOOGLE_PRIVATE_KEY } = process.env;
const client = new google.auth.JWT(BULLWISE_GOOGLE_CLIENT_EMAIL, null, BULLWISE_GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), ['https://www.googleapis.com/auth/spreadsheets']);
const authCache = {};

export const rangeMap = {
  ledger: 'Ledger!B3:G1000',
  balance: 'Ledger!B3:C3'
};

client.authorize((err, tokens) => {
  if (err) console.log(err);
  authCache.access_token = tokens.access_token;
});

export async function getSheetData(spreadsheetId, range) {
  try {
    const gsapi = google.sheets({ version: 'v4', auth: client })
    const data = await gsapi.spreadsheets.values.get({ spreadsheetId, range: range });
    return data.data.values || [];
  } catch (err) {
    console.log(err);
  }
}

export async function getAllSheetData(spreadsheetId, filter = () => true) {
  const gsapi = google.sheets({ version: 'v4', auth: client })
  const sheetNames = (await gsapi.spreadsheets.get({ spreadsheetId })).data.sheets
    .map(s => s.properties.title)
    .filter(filter)
  return (await Promise.all(sheetNames.map(async sheetName => ({
    sheet: sheetName,
    data: await exports.getSheetData(spreadsheetId, sheetName)
  })))).reduce((acc, { sheet, data }) => {
    acc[sheet] = data;
    return acc;
  }, {});
}

export async function createNewSheet(spreadsheetId, name) {
  const gsapi = google.sheets({ version: 'v4', auth: client });
  await gsapi.spreadsheets.batchUpdate({
    auth: client,
    spreadsheetId: spreadsheetId,
    resource: {
      requests: [{
        addSheet: {
          properties: {
            title: name
          }
        }
      }],
    }
  });
}

export async function writeToSheet(spreadsheetId, range, data) {
  try {
    const gsapi = google.sheets({ version: 'v4', auth: client });
    await gsapi.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: data,
      },
    });
  } catch (err) {
    console.log(err);
  }
}
