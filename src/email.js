import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import { config } from './config.js';

function getAuthenticatedClient(token) {
  return Client.init({
    authProvider: (done) => {
      done(null, token);
    },
  });
}

export async function fetchTrackingEmails(token, searchTerm) {
  const client = getAuthenticatedClient(token);
  // Search inbox for emails containing the searchTerm (PO# or customer name)
  const response = await client
    .api(`/users/${config.msGraphUserEmail}/mailFolders/inbox/messages`)
    .filter(`contains(subject,'${searchTerm}') or contains(body,'${searchTerm}')`)
    .top(10)
    .get();
  return response.value || [];
}

// TODO: Add logic to extract tracking numbers from email body based on vendor (UPS/FedEx)
