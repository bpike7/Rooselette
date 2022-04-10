import axios from 'axios';

const client = axios.create({
  baseURL: 'https://hooks.slack.com/services'
});

export async function reportError(errorMessage) {
  try {
    await client.post('/T0282FFTH96/B0279R7EBCM/l7gBiIMjzKexhxO4GUydhnOn', {
      text: errorMessage
    });
  } catch (err) {
    console.log(err);
  }
}
