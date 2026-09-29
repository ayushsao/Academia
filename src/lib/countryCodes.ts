// International dialling codes for phone fields: [ISO country code, calling code].
// The most common countries for our customers come first, then every country A–Z.

export const POPULAR_DIAL_CODES: [string, string][] = [
    ['IN', '91'], ['US', '1'], ['GB', '44'], ['AU', '61'], ['CA', '1'], ['AE', '971'],
];

export const DIAL_CODES: [string, string][] = [
    ['AF', '93'], ['AL', '355'], ['DZ', '213'], ['AS', '1684'], ['AD', '376'], ['AO', '244'], ['AI', '1264'], ['AG', '1268'],
    ['AR', '54'], ['AM', '374'], ['AW', '297'], ['AU', '61'], ['AT', '43'], ['AZ', '994'], ['BS', '1242'], ['BH', '973'],
    ['BD', '880'], ['BB', '1246'], ['BY', '375'], ['BE', '32'], ['BZ', '501'], ['BJ', '229'], ['BM', '1441'], ['BT', '975'],
    ['BO', '591'], ['BA', '387'], ['BW', '267'], ['BR', '55'], ['VG', '1284'], ['BN', '673'], ['BG', '359'], ['BF', '226'],
    ['BI', '257'], ['KH', '855'], ['CM', '237'], ['CA', '1'], ['CV', '238'], ['KY', '1345'], ['CF', '236'], ['TD', '235'],
    ['CL', '56'], ['CN', '86'], ['CO', '57'], ['KM', '269'], ['CG', '242'], ['CD', '243'], ['CK', '682'], ['CR', '506'],
    ['CI', '225'], ['HR', '385'], ['CU', '53'], ['CW', '599'], ['CY', '357'], ['CZ', '420'], ['DK', '45'], ['DJ', '253'],
    ['DM', '1767'], ['DO', '1809'], ['EC', '593'], ['EG', '20'], ['SV', '503'], ['GQ', '240'], ['ER', '291'], ['EE', '372'],
    ['SZ', '268'], ['ET', '251'], ['FK', '500'], ['FO', '298'], ['FJ', '679'], ['FI', '358'], ['FR', '33'], ['GF', '594'],
    ['PF', '689'], ['GA', '241'], ['GM', '220'], ['GE', '995'], ['DE', '49'], ['GH', '233'], ['GI', '350'], ['GR', '30'],
    ['GL', '299'], ['GD', '1473'], ['GP', '590'], ['GU', '1671'], ['GT', '502'], ['GG', '44'], ['GN', '224'], ['GW', '245'],
    ['GY', '592'], ['HT', '509'], ['HN', '504'], ['HK', '852'], ['HU', '36'], ['IS', '354'], ['IN', '91'], ['ID', '62'],
    ['IR', '98'], ['IQ', '964'], ['IE', '353'], ['IM', '44'], ['IL', '972'], ['IT', '39'], ['JM', '1876'], ['JP', '81'],
    ['JE', '44'], ['JO', '962'], ['KZ', '7'], ['KE', '254'], ['KI', '686'], ['XK', '383'], ['KW', '965'], ['KG', '996'],
    ['LA', '856'], ['LV', '371'], ['LB', '961'], ['LS', '266'], ['LR', '231'], ['LY', '218'], ['LI', '423'], ['LT', '370'],
    ['LU', '352'], ['MO', '853'], ['MG', '261'], ['MW', '265'], ['MY', '60'], ['MV', '960'], ['ML', '223'], ['MT', '356'],
    ['MH', '692'], ['MQ', '596'], ['MR', '222'], ['MU', '230'], ['YT', '262'], ['MX', '52'], ['FM', '691'], ['MD', '373'],
    ['MC', '377'], ['MN', '976'], ['ME', '382'], ['MS', '1664'], ['MA', '212'], ['MZ', '258'], ['MM', '95'], ['NA', '264'],
    ['NR', '674'], ['NP', '977'], ['NL', '31'], ['NC', '687'], ['NZ', '64'], ['NI', '505'], ['NE', '227'], ['NG', '234'],
    ['NU', '683'], ['KP', '850'], ['MK', '389'], ['MP', '1670'], ['NO', '47'], ['OM', '968'], ['PK', '92'], ['PW', '680'],
    ['PS', '970'], ['PA', '507'], ['PG', '675'], ['PY', '595'], ['PE', '51'], ['PH', '63'], ['PL', '48'], ['PT', '351'],
    ['PR', '1787'], ['QA', '974'], ['RE', '262'], ['RO', '40'], ['RU', '7'], ['RW', '250'], ['KN', '1869'], ['LC', '1758'],
    ['VC', '1784'], ['WS', '685'], ['SM', '378'], ['ST', '239'], ['SA', '966'], ['SN', '221'], ['RS', '381'], ['SC', '248'],
    ['SL', '232'], ['SG', '65'], ['SX', '1721'], ['SK', '421'], ['SI', '386'], ['SB', '677'], ['SO', '252'], ['ZA', '27'],
    ['KR', '82'], ['SS', '211'], ['ES', '34'], ['LK', '94'], ['SD', '249'], ['SR', '597'], ['SE', '46'], ['CH', '41'],
    ['SY', '963'], ['TW', '886'], ['TJ', '992'], ['TZ', '255'], ['TH', '66'], ['TL', '670'], ['TG', '228'], ['TO', '676'],
    ['TT', '1868'], ['TN', '216'], ['TR', '90'], ['TM', '993'], ['TC', '1649'], ['TV', '688'], ['UG', '256'], ['UA', '380'],
    ['AE', '971'], ['GB', '44'], ['US', '1'], ['UY', '598'], ['UZ', '998'], ['VU', '678'], ['VA', '379'], ['VE', '58'],
    ['VN', '84'], ['VI', '1340'], ['YE', '967'], ['ZM', '260'], ['ZW', '263'],
];

// The currency each country uses (ISO 4217). Prices are shown in it when the
// server has a live exchange rate for it; otherwise the calculator uses USD.
const COUNTRY_CURRENCY: Record<string, string> = {
    AF: 'AFN', AL: 'ALL', DZ: 'DZD', AS: 'USD', AD: 'EUR', AO: 'AOA', AI: 'XCD', AG: 'XCD', AR: 'ARS', AM: 'AMD', AW: 'AWG', AU: 'AUD',
    AT: 'EUR', AZ: 'AZN', BS: 'BSD', BH: 'BHD', BD: 'BDT', BB: 'BBD', BY: 'BYN', BE: 'EUR', BZ: 'BZD', BJ: 'XOF', BM: 'BMD', BT: 'BTN',
    BO: 'BOB', BA: 'BAM', BW: 'BWP', BR: 'BRL', VG: 'USD', BN: 'BND', BG: 'BGN', BF: 'XOF', BI: 'BIF', KH: 'KHR', CM: 'XAF', CA: 'CAD',
    CV: 'CVE', KY: 'KYD', CF: 'XAF', TD: 'XAF', CL: 'CLP', CN: 'CNY', CO: 'COP', KM: 'KMF', CG: 'XAF', CD: 'CDF', CK: 'NZD', CR: 'CRC',
    CI: 'XOF', HR: 'EUR', CU: 'CUP', CW: 'ANG', CY: 'EUR', CZ: 'CZK', DK: 'DKK', DJ: 'DJF', DM: 'XCD', DO: 'DOP', EC: 'USD', EG: 'EGP',
    SV: 'USD', GQ: 'XAF', ER: 'ERN', EE: 'EUR', SZ: 'SZL', ET: 'ETB', FK: 'FKP', FO: 'DKK', FJ: 'FJD', FI: 'EUR', FR: 'EUR', GF: 'EUR',
    PF: 'XPF', GA: 'XAF', GM: 'GMD', GE: 'GEL', DE: 'EUR', GH: 'GHS', GI: 'GIP', GR: 'EUR', GL: 'DKK', GD: 'XCD', GP: 'EUR', GU: 'USD',
    GT: 'GTQ', GG: 'GBP', GN: 'GNF', GW: 'XOF', GY: 'GYD', HT: 'HTG', HN: 'HNL', HK: 'HKD', HU: 'HUF', IS: 'ISK', IN: 'INR', ID: 'IDR',
    IR: 'IRR', IQ: 'IQD', IE: 'EUR', IM: 'GBP', IL: 'ILS', IT: 'EUR', JM: 'JMD', JP: 'JPY', JE: 'GBP', JO: 'JOD', KZ: 'KZT', KE: 'KES',
    KI: 'AUD', XK: 'EUR', KW: 'KWD', KG: 'KGS', LA: 'LAK', LV: 'EUR', LB: 'LBP', LS: 'LSL', LR: 'LRD', LY: 'LYD', LI: 'CHF', LT: 'EUR',
    LU: 'EUR', MO: 'MOP', MG: 'MGA', MW: 'MWK', MY: 'MYR', MV: 'MVR', ML: 'XOF', MT: 'EUR', MH: 'USD', MQ: 'EUR', MR: 'MRU', MU: 'MUR',
    YT: 'EUR', MX: 'MXN', FM: 'USD', MD: 'MDL', MC: 'EUR', MN: 'MNT', ME: 'EUR', MS: 'XCD', MA: 'MAD', MZ: 'MZN', MM: 'MMK', NA: 'NAD',
    NR: 'AUD', NP: 'NPR', NL: 'EUR', NC: 'XPF', NZ: 'NZD', NI: 'NIO', NE: 'XOF', NG: 'NGN', NU: 'NZD', KP: 'KPW', MK: 'MKD', MP: 'USD',
    NO: 'NOK', OM: 'OMR', PK: 'PKR', PW: 'USD', PS: 'ILS', PA: 'USD', PG: 'PGK', PY: 'PYG', PE: 'PEN', PH: 'PHP', PL: 'PLN', PT: 'EUR',
    PR: 'USD', QA: 'QAR', RE: 'EUR', RO: 'RON', RU: 'RUB', RW: 'RWF', KN: 'XCD', LC: 'XCD', VC: 'XCD', WS: 'WST', SM: 'EUR', ST: 'STN',
    SA: 'SAR', SN: 'XOF', RS: 'RSD', SC: 'SCR', SL: 'SLE', SG: 'SGD', SX: 'ANG', SK: 'EUR', SI: 'EUR', SB: 'SBD', SO: 'SOS', ZA: 'ZAR',
    KR: 'KRW', SS: 'SSP', ES: 'EUR', LK: 'LKR', SD: 'SDG', SR: 'SRD', SE: 'SEK', CH: 'CHF', SY: 'SYP', TW: 'TWD', TJ: 'TJS', TZ: 'TZS',
    TH: 'THB', TL: 'USD', TG: 'XOF', TO: 'TOP', TT: 'TTD', TN: 'TND', TR: 'TRY', TM: 'TMT', TC: 'USD', TV: 'AUD', UG: 'UGX', UA: 'UAH',
    AE: 'AED', GB: 'GBP', US: 'USD', UY: 'UYU', UZ: 'UZS', VU: 'VUV', VA: 'EUR', VE: 'VES', VN: 'VND', VI: 'USD', YE: 'YER', ZM: 'ZMW',
    ZW: 'USD',
};

/** Currency for a dial-code option such as "NP(+977)" (USD when unknown). */
export const currencyForDial = (dial: string) => COUNTRY_CURRENCY[dial.slice(0, 2).toUpperCase()] || 'USD';

/** Option label and value, e.g. "IN(+91)". */
export const dialLabel = ([iso, code]: [string, string]) => `${iso}(+${code})`;

/** Country name for a tooltip, e.g. "India". */
export const countryName = (iso: string) => {
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(iso) || iso; } catch { return iso; }
};
