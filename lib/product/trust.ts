// The trust line under the breakdown: how many engine tests check the tax maths, and where the cross-check lives.

/**
 * Number of engine tests (lib/tax/__tests__, the same tests as engine/test). A unit test counts them, so this
 * fails loudly when an engine test is added or removed.
 */
export const ENGINE_TEST_COUNT = 71;

/** The README section with the engine vs hand-done 1040-ES worksheet table. */
export const VERIFIED_URL = "https://github.com/DataMata2/zimran-cup-app#verified-against-the-irs-worksheet";
