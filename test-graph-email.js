import { config } from './src/config.js';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import fetch from 'node-fetch';

async function getToken() {
  const url = `https://login.microsoftonline.com/${config.msGraphTenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('client_id', config.msGraphClientId);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('client_secret', config.msGraphClientSecret);
  params.append('grant_type', 'client_credentials');

  const res = await fetch(url, {
    method: 'POST',
    body: params
  });
  if (!res.ok) throw new Error('Failed to get token: ' + (await res.text()));
  const data = await res.json();
  return data.access_token;
}

function getAuthenticatedClient(token) {
  return Client.init({
    authProvider: (done) => {
      done(null, token);
    },
  });
}

async function main() {
  try {
    const token = await getToken();
    const client = getAuthenticatedClient(token);
    const messages = await client
      .api(`/users/${config.msGraphUserEmail}/mailFolders/inbox/messages`)
      .top(5)
      .select('subject,from,receivedDateTime')
      .orderby('receivedDateTime DESC')
      .get();
    console.log('Recent emails:');
    for (const msg of messages.value) {
      console.log(`- ${msg.receivedDateTime}: ${msg.subject} (from: ${msg.from.emailAddress.address})`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
