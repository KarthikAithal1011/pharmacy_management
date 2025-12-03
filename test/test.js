const assert = require('assert');
const express = require('express');
const session = require('express-session');
const request = require('supertest');

// Mock the database connection
jest.mock('mysql2', () => {
  const mockConnection = {
    connect: jest.fn(),
    query: jest.fn(),
  };
  return {
    createConnection: jest.fn(() => mockConnection),
  };
});

const app = require('./server'); // Assuming your server file is named server.js

describe('Receipts Route', () => {
  it('should render the receipts page with showNav set to true', (done) => {
    const mockPurchases = [
      { medicine: 'A', quantity: 1, pricePerTablet: 1, total: 1 },
      { medicine: 'B', quantity: 2, pricePerTablet: 2, total: 4 },
    ];

    request(app)
      .get('/receipts')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        // Check if the rendered HTML contains the navigation bar
        assert(res.text.includes('<nav class="bg-white shadow-modern border-b border-gray-100 sticky top-0 z-50">'));
        done();
      });
  });
});
