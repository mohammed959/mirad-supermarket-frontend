import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/*
 * These are structural / static-source contract tests. They exist
 * because the frontend has no React test runner installed (spec says
 * "do not introduce a new test framework solely for this step"). They
 * verify the SAME invariants a rendered test would — no HTTP fetch
 * when a prop is provided, no aggregate fallback to legacy, etc. — by
 * inspecting the source rather than the DOM.
 *
 * Every test below anchors on a comment or exact string in the source.
 * If a refactor renames one, update BOTH sides in the same commit.
 */

describe('No fabricated stock anywhere in aggregate code', () => {
  const aggregateFiles = [
    'src/lib/aggregateAdapter.ts',
    'src/lib/homeAggregate.ts',
    'src/hooks/useHomeAggregate.ts',
    'src/app/(customer)/page.tsx',
    'src/components/customer/ProductCard.tsx',
  ];

  test('no magic stock-ceiling constant remains', () => {
    for (const f of aggregateFiles) {
      const src = read(f);
      assert.equal(
        /AGGREGATE_STOCK_CEILING/.test(src),
        false,
        `${f} must not reference the removed AGGREGATE_STOCK_CEILING constant`,
      );
    }
  });

  test('adapter never fabricates a stock cap (999 / MAX_SAFE_INTEGER / Infinity)', () => {
    const src = read('src/lib/aggregateAdapter.ts');
    assert.equal(/\b999\b/.test(src), false);
    assert.equal(/MAX_SAFE_INTEGER/.test(src), false);
    assert.equal(/Infinity/.test(src), false);
    // And the honest signal IS present:
    assert.match(src, /stock:\s*null/);
    assert.match(src, /reserved:\s*null/);
  });

  test('ProductCard treats null stock as "unknown max" (undefined stepper cap)', () => {
    const src = read('src/components/customer/ProductCard.tsx');
    // The unknown-max branch is explicit and typed against `number`.
    assert.match(src, /hasKnownStock/);
    assert.match(src, /maxQty\s*=\s*hasKnownStock\s*\?/);
  });
});

describe('Legacy exact-stock behavior remains unchanged', () => {
  test('ProductCard still computes a real max when stock/reserved are numbers', () => {
    const src = read('src/components/customer/ProductCard.tsx');
    // Real Math.max(0, stock - reserved) still lives in the known-stock branch.
    assert.match(
      src,
      /Math\.max\(0,\s*\(product\.stock as number\)\s*-\s*\(product\.reserved as number\)\)/,
    );
  });

  test('Legacy /product-list infinite loader is not touched', () => {
    const src = read('src/hooks/useInfiniteProducts.ts');
    assert.match(src, /useSWRInfinite/);
    // The hook takes a URL builder — the actual `/products` path lives
    // at the call site, not inside the hook. What we assert here is
    // that the hook has NOT been rewired to consume the aggregate.
    assert.equal(/useHomeAggregate|HomeAggregate|storefront\/home/.test(src), false);
  });
});

describe('Envelope unwrap contract (fetcher never double-unwraps)', () => {
  test('fetchHomeAggregate returns res.data.data — exactly one unwrap', () => {
    const src = read('src/lib/homeAggregate.ts');
    assert.match(src, /res\.data\.data\b/);
    assert.equal(/\.data\.data\.data/.test(src), false, 'must not double-unwrap the envelope');
  });
});

describe('Aggregate hook / flag wiring', () => {
  test('useHomeAggregate passes null SWR key when the flag is off', () => {
    const src = read('src/hooks/useHomeAggregate.ts');
    assert.match(src, /USE_HOME_AGGREGATE\s*\?\s*HOME_AGGREGATE_SWR_KEY\s*:\s*null/);
  });

  test('flag parser is imported from lib/flags, not re-derived inline', () => {
    const src = read('src/hooks/useHomeAggregate.ts');
    assert.match(src, /from ['"]@\/lib\/flags['"]/);
  });
});

describe('HomePage branching (single hook set per render)', () => {
  const src = read('src/app/(customer)/page.tsx');

  test('renders exactly one of <AggregateHome /> or <LegacyHome />', () => {
    assert.match(src, /if\s*\(\s*USE_HOME_AGGREGATE\s*\)\s*return\s*<AggregateHome/);
    assert.match(src, /return\s*<LegacyHome/);
  });

  test('AggregateHome is the only caller of useHomeAggregate on the homepage', () => {
    const matches = src.match(/useHomeAggregate\(/g) ?? [];
    assert.equal(matches.length, 1, 'useHomeAggregate should be called exactly once on the homepage');
  });

  test('BuyAgainStrip is rendered in both paths (customer-only, stays independent)', () => {
    const matches = src.match(/<BuyAgainStrip/g) ?? [];
    assert.equal(matches.length, 2);
  });

  test('Legacy /categories?home=true fetch appears ONLY inside LegacyHome', () => {
    const catFetches = src.match(/\/categories\?home=true/g) ?? [];
    assert.equal(catFetches.length, 1);
    // And AggregateHome does NOT contain that legacy path.
    const aggregateBody = src.slice(src.indexOf('function AggregateHome'), src.indexOf('export default'));
    assert.equal(/\/categories\?home=true/.test(aggregateBody), false);
  });
});

describe('Strip components skip SWR when props are provided', () => {
  const cases = [
    { file: 'src/components/customer/BannerCarousel.tsx',        legacyKey: "'/banners'" },
    { file: 'src/components/customer/FeaturedStrip.tsx',         legacyKey: "'/products/featured'" },
    { file: 'src/components/customer/FeaturedSectionsList.tsx',  legacyKey: "'/featured-sections'" },
  ];

  for (const c of cases) {
    test(`${c.file} passes null as SWR key when the prop is supplied`, () => {
      const src = read(c.file);
      assert.match(src, new RegExp(`useProps\\s*\\?\\s*null\\s*:\\s*${c.legacyKey.replace(/[\\/[]/g, '\\$&')}`));
    });
  }

  test('AllProductsStrip skips BOTH the settings AND the products SWR calls when the prop is supplied', () => {
    const src = read('src/components/customer/AllProductsStrip.tsx');
    assert.match(src, /useProps\s*\?\s*null\s*:\s*['"]\/settings\/home['"]/);
    assert.match(
      src,
      /useProps\s*\?\s*null\s*:\s*`\/products\?page=1&pageSize=\$\{limit\}&excludeHiddenFromHome=true`/,
    );
  });
});

describe('Aggregate wiring in HomePage (props, not per-strip hook)', () => {
  const src = read('src/app/(customer)/page.tsx');
  test('BannerCarousel receives banners via prop', () => {
    assert.match(src, /<BannerCarousel\s+banners=/);
  });
  test('FeaturedStrip receives featured via prop', () => {
    assert.match(src, /<FeaturedStrip\s+featured=/);
  });
  test('FeaturedSectionsList receives sections via prop', () => {
    assert.match(src, /<FeaturedSectionsList\s+sections=/);
  });
  test('AllProductsStrip receives allProducts via prop', () => {
    assert.match(src, /<AllProductsStrip[\s\S]*?allProducts=/);
  });
});

describe('Aggregate categories are passed through props → legacy categories request is suppressed', () => {
  const src = read('src/app/(customer)/page.tsx');
  test('AggregateHome derives categories from data.categories', () => {
    assert.match(src, /data\?\.categories\s*\?\?\s*\[\]/);
  });
  test('AggregateHome renders <HomeCategoriesRow categories={…} />', () => {
    // Anchored inside AggregateHome only.
    const aggBody = src.slice(src.indexOf('function AggregateHome'), src.indexOf('export default'));
    assert.match(aggBody, /<HomeCategoriesRow\s+categories=\{categories\}/);
  });
  test('HomeCategoriesRow itself is untouched — no aggregate fetching inside the component', () => {
    const src2 = read('src/components/customer/HomeCategoriesRow.tsx');
    assert.equal(/useHomeAggregate|useSWR|api\.get/.test(src2), false);
  });
});

describe('Aggregate error state: visible UI + retry, no legacy fallback', () => {
  const src = read('src/app/(customer)/page.tsx');
  test('reads `error` and `mutate` from useHomeAggregate', () => {
    assert.match(src, /const\s*\{[^}]*\berror\b[^}]*\bmutate\b[^}]*\}\s*=\s*useHomeAggregate\(\)/);
  });
  test('renders a visible error branch when error && !data', () => {
    assert.match(src, /if\s*\(\s*error\s*&&\s*!data\s*\)/);
  });
  test('retry button calls mutate() (SWR revalidation), not a legacy fetcher', () => {
    assert.match(src, /onClick=\{\(\)\s*=>\s*mutate\(\)\}/);
  });
  test('does NOT auto-fall-back to legacy endpoints on aggregate error', () => {
    // No catch block that then calls the legacy /categories?home=true, /banners, etc.
    assert.equal(/catch[\s\S]*?\/categories\?home=true/.test(src), false);
    assert.equal(/catch[\s\S]*?useSWR<Category/.test(src), false);
    // Only one useSWR call in this file (inside LegacyHome).
    const swrCalls = src.match(/useSWR</g) ?? [];
    assert.equal(swrCalls.length, 1);
  });
  test('error branch uses the localized `home.loadError` / `home.retry` keys', () => {
    assert.match(src, /t\(\s*['"]loadError['"]\s*\)/);
    assert.match(src, /t\(\s*['"]retry['"]\s*\)/);
    assert.match(src, /useTranslations\(\s*['"]home['"]\s*\)/);
  });
});

describe('Empty aggregate success is distinguishable from failure', () => {
  const src = read('src/app/(customer)/page.tsx');
  test('empty arrays render the normal homepage (with strip empty-states)', () => {
    // Every strip receives `data?.X ?? []` when data resolves — those
    // empty arrays flow through the normal render, NOT the error UI.
    assert.match(src, /data\?\.banners\s*\?\?\s*\[\]/);
    assert.match(src, /data\?\.featuredProducts\s*\?\?\s*\[\]/);
    assert.match(src, /data\?\.featuredSections\s*\?\?\s*\[\]/);
    assert.match(src, /data\?\.allProducts\s*\?\?\s*\{\s*items:\s*\[\],\s*hasMore:\s*false\s*\}/);
  });
  test('error branch is guarded by `!data` — visible ONLY when nothing was loaded', () => {
    assert.match(src, /if\s*\(\s*error\s*&&\s*!data\s*\)/);
  });
});

describe('i18n parity for the new home error keys', () => {
  const en = JSON.parse(read('src/messages/en.json'));
  const ar = JSON.parse(read('src/messages/ar.json'));
  test('en.json and ar.json both carry home.loadError and home.retry', () => {
    for (const dict of [en, ar]) {
      assert.equal(typeof dict.home?.loadError, 'string');
      assert.equal(dict.home.loadError.length > 0, true);
      assert.equal(typeof dict.home?.retry, 'string');
      assert.equal(dict.home.retry.length > 0, true);
    }
  });
});

describe('Independent flows remain untouched by aggregate mode', () => {
  test('BuyAgainStrip still targets /orders/buy-again', () => {
    const src = read('src/components/customer/BuyAgainStrip.tsx');
    assert.match(src, /\/orders\/buy-again/);
    assert.equal(/useHomeAggregate|HomeAggregate/.test(src), false);
  });

  test('MarketplaceGate still calls /delivery/branch', () => {
    const src = read('src/components/customer/MarketplaceGate.tsx');
    assert.match(src, /\/delivery\/branch/);
  });

  test('LocationGate still calls /delivery/check-coverage', () => {
    const src = read('src/components/customer/LocationGate.tsx');
    assert.match(src, /\/delivery\/check-coverage/);
    assert.match(src, /\/delivery\/branch/);
  });
});

describe('Aggregate hook is used ONLY by the homepage', () => {
  const filesToInspect = [
    'src/components/customer/BannerCarousel.tsx',
    'src/components/customer/FeaturedStrip.tsx',
    'src/components/customer/FeaturedSectionsList.tsx',
    'src/components/customer/AllProductsStrip.tsx',
    'src/components/customer/HomeCategoriesRow.tsx',
    'src/components/customer/BuyAgainStrip.tsx',
  ];
  for (const f of filesToInspect) {
    test(`${f} does not call useHomeAggregate`, () => {
      const src = read(f);
      assert.equal(/useHomeAggregate\(/.test(src), false);
    });
  }
});
