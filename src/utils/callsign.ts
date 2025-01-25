interface PrefixMap {
  [key: string]: string;
}

const prefixMap: PrefixMap = {
  "2": "gb",
  "3A": "mc",
  "3B": "mu",
  "3C": "gq",
  "3D[A-M]": "sz",
  "3D[N-Z]": "fj",
  "3G": "cl",
  "3V": "tn",
  "3W": "vn",
  "3X": "gn",
  "3Y": "no",
  "3Z": "pl",
  "3[E-F]": "pa",
  "3[H-U]": "cn",
  "4L": "ge",
  "4M": "ve",
  "4O": "me",
  "4T": "pe",
  "4U": "un",
  "4V": "ht",
  "4W": "tl",
  "4X": "il",
  "4Z": "il",
  "4[A-C]": "mx",
  "4[D-I]": "ph",
  "4[J-K]": "az",
  "4[P-S]": "lk",
  "5A": "ly",
  "5B": "cy",
  "5T": "mr",
  "5U": "ne",
  "5V": "tg",
  "5W": "ws",
  "5X": "ug",
  "5[C-G]": "ma",
  "5[H-I]": "tz",
  "5[J-K]": "co",
  "5[L-M]": "lr",
  "5[N-O]": "ng",
  "5[P-Q]": "dk",
  "5[R-S]": "mg",
  "5[Y-Z]": "ke",
  "6C": "sy",
  "6O": "so",
  "6X": "mg",
  "6Y": "jm",
  "6Z": "lr",
  "6[A-B]": "eg",
  "6[D-J]": "mx",
  "6[K-N]": "kr",
  "6[P-S]": "pk",
  "6[T-U]": "sd",
  "6[V-W]": "sn",
  "7O": "ye",
  "7P": "ls",
  "7Q": "mw",
  "7R": "dz",
  "7S": "se",
  "7Z": "sa",
  "7[A-I]": "id",
  "7[J-N]": "jp",
  "7[T-Y]": "dz",
  "8O": "bw",
  "8P": "bb",
  "8Q": "mv",
  "8R": "gy",
  "8S": "se",
  "8Z": "sa",
  "8[A-I]": "id",
  "8[J-N]": "jp",
  "8[T-Y]": "in",
  "9A": "hr",
  "9G": "gh",
  "9H": "mt",
  "9K": "kw",
  "9L": "sl",
  "9M": "my",
  "9N": "np",
  "9U": "bi",
  "9V": "sg",
  "9W": "my",
  "9X": "rw",
  "9[B-D]": "ir",
  "9[E-F]": "et",
  "9[I-J]": "zm",
  "9[O-T]": "cd",
  "9[Y-Z]": "tt",
  "A2": "bw",
  "A3": "to",
  "A4": "om",
  "A5": "bt",
  "A6": "ae",
  "A7": "qa",
  "A8": "lr",
  "A9": "bh",
  "AX": "au",
  "A[A-L]": "us",
  "A[M-O]": "es",
  "A[P-S]": "pk",
  "A[T-W]": "in",
  "A[Y-Z]": "ar",
  "B": "cn",
  "C2": "nr",
  "C3": "ad",
  "C4": "cy",
  "C5": "gm",
  "C6": "bs",
  "C7": "wm",
  "CN": "ma",
  "CO": "cu",
  "CP": "bo",
  "C[8-9]": "mz",
  "C[A-E]": "cl",
  "C[F-K]": "ca",
  "C[L-M]": "cu",
  "C[Q-U]": "pt",
  "C[V-X]": "uy",
  "C[Y-Z]": "ca",
  "D4": "cv",
  "D5": "lr",
  "D6": "km",
  "D[2-3]": "ao",
  "D[7-9]": "kr",
  "D[A-R]": "de",
  "D[S-T]": "kr",
  "D[U-Z]": "ph",
  "E2": "th",
  "E3": "er",
  "E4": "ps",
  "E5": "ck",
  "E6": "nu",
  "E7": "ba",
  "EK": "am",
  "EL": "lr",
  "ER": "md",
  "ES": "ee",
  "ET": "et",
  "EX": "kg",
  "EY": "tj",
  "EZ": "tm",
  "E[A-H]": "es",
  "E[I-J]": "ie",
  "E[M-O]": "ua",
  "E[P-Q]": "ir",
  "E[U-W]": "by",
  "F": "fr",
  "G": "gb",
  "H2": "cy",
  "H3": "pa",
  "H4": "sb",
  "HA": "hu",
  "HB": "ch",
  "HE": "ch",
  "HF": "pl",
  "HG": "hu",
  "HH": "ht",
  "HI": "do",
  "HL": "kr",
  "HM": "kp",
  "HN": "iq",
  "HS": "th",
  "HT": "ni",
  "HU": "sv",
  "HV": "va",
  "HZ": "sa",
  "H[6-7]": "ni",
  "H[8-9]": "pa",
  "H[C-D]": "ec",
  "H[J-K]": "co",
  "H[O-P]": "pa",
  "H[Q-R]": "hn",
  "H[W-Y]": "fr",
  "I": "it",
  "J2": "dj",
  "J3": "gd",
  "J4": "gr",
  "J5": "gw",
  "J6": "lc",
  "J7": "dm",
  "J8": "vc",
  "JY": "jo",
  "JZ": "id",
  "J[A-S]": "jp",
  "J[T-V]": "mn",
  "J[W-X]": "no",
  "K": "us",
  "LX": "lu",
  "LY": "lt",
  "LZ": "bg",
  "L[2-9]": "ar",
  "L[A-N]": "no",
  "L[O-W]": "ar",
  "M": "gb",
  "N": "us",
  "OD": "lb",
  "OE": "at",
  "OM": "sk",
  "O[A-C]": "pe",
  "O[F-J]": "fi",
  "O[K-L]": "cz",
  "O[N-T]": "be",
  "O[U-Z]": "dk",
  "P2": "pg",
  "P3": "cy",
  "P4": "aw",
  "PJ": "sx",
  "PZ": "sr",
  "P[5-9]": "kp",
  "P[A-I]": "nl",
  "P[K-O]": "id",
  "P[P-Y]": "br",
  "R": "ru",
  "S5": "si",
  "S6": "sg",
  "S7": "sc",
  "S8": "za",
  "S9": "st",
  "SS[A-M]": "eg",
  "SS[N-Z]": "sd",
  "ST": "sd",
  "SU": "eg",
  "S[2-3]": "bd",
  "S[A-M]": "se",
  "S[N-R]": "pl",
  "S[V-Z]": "gr",
  "T2": "tv",
  "T3": "ki",
  "T4": "cu",
  "T5": "so",
  "T6": "af",
  "T7": "sm",
  "T8": "pw",
  "TD": "gt",
  "TE": "cr",
  "TF": "is",
  "TG": "gt",
  "TH": "fr",
  "TI": "cr",
  "TJ": "cm",
  "TK": "fr",
  "TL": "cf",
  "TM": "fr",
  "TN": "cg",
  "TR": "ga",
  "TS": "tn",
  "TT": "td",
  "TU": "ci",
  "TY": "bj",
  "TZ": "ml",
  "T[A-C]": "tr",
  "T[O-Q]": "fr",
  "T[V-X]": "fr",
  "U[A-I]": "ru",
  "U[J-M]": "uz",
  "U[N-Q]": "kz",
  "U[R-Z]": "ua",
  "V2": "ag",
  "V3": "bz",
  "V4": "kn",
  "V5": "na",
  "V6": "fm",
  "V7": "mh",
  "V8": "bn",
  "VO": "ca",
  "VR": "hk",
  "VS": "gb",
  "VZ": "au",
  "V[A-G]": "ca",
  "V[H-N]": "au",
  "V[P-Q]": "gb",
  "V[T-W]": "in",
  "V[X-Y]": "ca",
  "W": "us",
  "XP": "dk",
  "XS": "cn",
  "XT": "bf",
  "XU": "kh",
  "XV": "vn",
  "XW": "la",
  "XX": "mo",
  "X[A-I]": "mx",
  "X[J-O]": "ca",
  "X[Q-R]": "cl",
  "X[Y-Z]": "mm",
  "YA": "af",
  "YI": "iq",
  "YJ": "vu",
  "YK": "sy",
  "YL": "lv",
  "YM": "tr",
  "YN": "ni",
  "YS": "sv",
  "Y[2-9]": "de",
  "Y[B-H]": "id",
  "Y[O-R]": "ro",
  "Y[T-U]": "rs",
  "Y[V-Y]": "ve",
  "Z2": "zw",
  "Z3": "mk",
  "Z8": "ss",
  "ZA": "al",
  "ZP": "py",
  "ZQ": "gb",
  "Z[B-J]": "gb",
  "Z[K-M]": "nz",
  "Z[N-O]": "gb",
  "Z[R-U]": "za",
  "Z[V-Z]": "br"
};

export function getCountryCodeForCallsign(callsign: string): string {
  callsign = callsign.toUpperCase();
  const knownPrefixes = Object.keys(prefixMap).sort((a, b) => b.length - a.length);
  
  for (const prefix of knownPrefixes) {
    // Convert prefix pattern to regex
    const regexStr = prefix.replace(/\[([A-Z])-([A-Z])\]/g, '[$1-$2]');
    const regex = new RegExp(`^${regexStr}`);
    
    if (regex.test(callsign)) {
      return prefixMap[prefix];
    }
  }
  return 'xx';
}
