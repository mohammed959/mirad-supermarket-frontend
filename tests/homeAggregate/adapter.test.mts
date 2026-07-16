import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { aggregateCardToProduct } from '../../src/lib/aggregateAdapter.ts';

const baseCard = {
  id: 'p1',
  name: 'Milk 1L',
  nameAr: 'حليب 1 لتر',
  sku: 'MLK-1L',
  imageUrl: 'https://cdn.example.net/products/MLK-1L.png',
  price: '6.50',
  available: true,
};

describe('aggregateCardToProduct — no fabricated stock', () => {
  test('never invents a stock ceiling — stock/reserved are null (unknown)', () => {
    const p = aggregateCardToProduct(baseCard);
    // Neither an arbitrary large number nor 0 — an honest "unknown".
    assert.equal(p.stock, null);
    assert.equal(p.reserved, null);
  });

  test('forwards `available` verbatim so ProductCard skips the stock fallback branch', () => {
    assert.equal(aggregateCardToProduct({ ...baseCard, available: true }).available, true);
    assert.equal(aggregateCardToProduct({ ...baseCard, available: false }).available, false);
  });

  test('preserves nullable price without crashing', () => {
    const p = aggregateCardToProduct({ ...baseCard, price: null });
    assert.equal(p.price, null);
    assert.equal(p.id, 'p1');
    assert.equal(p.imageUrl, baseCard.imageUrl);
  });

  test('preserves nullable sku without crashing', () => {
    const p = aggregateCardToProduct({ ...baseCard, sku: null });
    assert.equal(p.sku, null);
    assert.equal(p.imageUrl, baseCard.imageUrl);
  });

  test('non-nullable imageUrl passes through as a plain string', () => {
    const url = 'https://cdn.example.net/products/X.png';
    const p = aggregateCardToProduct({ ...baseCard, imageUrl: url });
    assert.equal(p.imageUrl, url);
    assert.equal(typeof p.imageUrl, 'string');
  });

  test('emits harmless defaults for legacy Product fields not on the wire', () => {
    const p = aggregateCardToProduct(baseCard);
    assert.equal(p.description, null);
    assert.equal(p.descriptionAr, null);
    assert.equal(p.barcode, null);
    assert.equal(p.isFeatured, false);
    assert.equal(p.isActive, true);
    assert.equal(p.subcategory, null);
    assert.equal(p.brand, null);
    assert.deepEqual(p.variants, []);
    assert.deepEqual(p.category, { id: '', name: '', nameAr: '' });
  });

  test('is pure — same input yields deep-equal output', () => {
    const a = aggregateCardToProduct(baseCard);
    const b = aggregateCardToProduct(baseCard);
    assert.deepEqual(a, b);
  });
});
