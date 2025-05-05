import { JSONContent } from "@tiptap/react"

export const canonicalize = (s: string) =>
  s.replace(/׳/g, "'").replace(/״/g, '"')

export const onlySpecificAllowed = (v: string, l: string[], error?: string) => {
  if (!l.includes(v)) {
    return error ?? `חייב להיות אחת מבין ${l.join(", ")}!`
  }
}

export const mustInclude = (v: string, r: RegExp, error: string) => {
  if (!r.exec(v)) {
    return error
  }
}

export const mustNotIncludeWord = (v: string, word: string, error?: string) => {
  if (v.split(/\s/g).includes(word)) {
    return error ?? `אסור להשתמש במילה '${word}'!`
  }
}

export const HOUR_MATCHER = /(\d\d?):(\d\d?)/g
export const DATE_MATCHER =
  /(\d\d?).(\d\d?).(\d\d\d?\d?)|(\d\d?)\/(\d\d?)\/(\d\d\d?\d?)/g
export const RESPONSIBILITY_MATCHER = /אחריות.*תג.?ב.*/g
export const RESPONSIBLE_MATCHER = /אחראי.*תג.?ב.*/g

export const hoursMustBeFull = (v: string) => {
  let match
  const hourMatcher = new RegExp(HOUR_MATCHER)
  while ((match = hourMatcher.exec(v))) {
    for (const part of match.slice(1)) {
      if (part.length !== 2) {
        return "יש לכתוב שעות מלאות! למשל 07:00 ולא 7:00"
      }
    }
  }
}

export const datesMustBeFull = (v: string) => {
  let match
  const dateMatcher = new RegExp(DATE_MATCHER)
  while ((match = dateMatcher.exec(v))) {
    if (match[0].includes(".")) {
      return "תאריכים צריכים להיות עם לוכסן ולא עם נקודה, למשל 27/04/2025 ולא 27.04.2025!"
    }
    if (
      match[1].length !== 2 ||
      match[2].length !== 2 ||
      match[3].length !== 4
    ) {
      return "תאריכים צריכים להיות מלאים, למשל 27/04/2025!"
    }
  }
}

export const tableCellChecker = (
  v: JSONContent,
  inOrderedList = false,
  root = true,
): string | undefined => {
  if (v.type === "text" && inOrderedList && !v.text?.endsWith(".")) {
    return "במידה ויש כמה משפטים שונים, יש למספר כל אחד בשורה אחרת ונקודה בסוף משפט!"
  }

  if (v.type === "text" && !inOrderedList && v.text && v.text.endsWith(".")) {
    return "במידה ויש משפט אחד במשבצת - ללא נקודה בסוף משפט!"
  }

  if (
    root &&
    v.type !== "paragraph" &&
    v.type !== "orderedList" &&
    v.type !== "doc"
  ) {
    return "במידה ויש כמה משפטים שונים, יש למספר כל אחד בשורה אחרת ונקודה בסוף משפט!"
  }

  for (const child of v.content ?? []) {
    const result = tableCellChecker(
      child,
      v.type === "orderedList" ? true : inOrderedList,
      v.type === "doc" ? true : false,
    )
    if (result) {
      return result
    }
  }
}

export const debriefChronologicalOrderChecker = (
  v: JSONContent,
  root = true,
): string | undefined => {
  if (root && v.type !== "orderedList" && v.type !== "doc" && v.content) {
    return "הרצף הכרונולוגי חייב להיות ממוספר!"
  }

  for (const child of v.content ?? []) {
    const result = debriefChronologicalOrderChecker(
      child,
      v.type === "doc" ? true : false,
    )
    if (result) {
      return result
    }
  }
}

export const debriefLearnedChecker = (
  v: JSONContent,
  root = true,
): string | undefined => {
  if (root && v.type !== "orderedList" && v.type !== "doc" && v.content) {
    return "הלקחים חייבים להיות ממוספרים (השתמשו בכפתור המספור האוטומטי ״1.״ והוא יהיה תקין לפי כתיבה צבאית)!"
  }

  if (v.type === "paragraph" && v.content) {
    const responsibility = v.content?.find(
      (t) =>
        new RegExp(RESPONSIBLE_MATCHER).exec(t.text ?? "") ||
        new RegExp(RESPONSIBLE_MATCHER).exec(t.text ?? ""),
    )
    if (!responsibility) {
      return "יש להגדיר לכל לקח אחראי/ת ותג״ב!"
    }

    if (
      !responsibility.marks?.some((mark) => mark.type === "bold") ||
      !responsibility.marks?.some((mark) => mark.type === "underline")
    ) {
      return "יש להדגיש אחראי/ת ותג״ב ולהוסיף קו תחתון!"
    }
  }

  for (const child of v.content ?? []) {
    const result = debriefLearnedChecker(child, v.type === "doc" ? true : false)
    if (result) {
      return result
    }
  }
}
