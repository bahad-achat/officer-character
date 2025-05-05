const response = await fetch(
  "https://docs.google.com/spreadsheets/d/1_atS9R1RyunqVtf47ChzBZRJmU6v_eiDXDVwzE53upI/gviz/tq?tqx=out:json",
)
const text = await response.text()

const jsonText = text.substring(text.indexOf("{"), text.length - 2)
const json = JSON.parse(jsonText)

const questions: any[] = []
const teamToCategory = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  5, 5,
]

json.table.rows.forEach((row: any) => {
  let v = row.c[2]?.v
  if (v && typeof v === "string") {
    v = parseInt(
      v
        .split("")
        .filter((x) =>
          ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(x),
        )
        .join(""),
      10,
    )
  }
  v--

  const tryAddQuestion = (index: number) => {
    if (!row.c[index]?.v || !row.c[index + 1]?.v) {
      return
    }

    const answers: { text: string; correct?: boolean }[] = [
      { text: row.c[index + 1].v, correct: true },
    ]
    if (row.c[index + 2]?.v) {
      answers.push({ text: row.c[index + 2].v })
    }
    if (row.c[index + 3]?.v) {
      answers.push({ text: row.c[index + 3].v })
    }
    if (row.c[index + 4]?.v) {
      answers.push({ text: row.c[index + 4].v })
    }

    if (answers.length < 2) {
      return
    }

    questions.push({
      prompt: row.c[index].v,
      answers,
      chapter: teamToCategory[v],
    })
  }

  tryAddQuestion(3)
  tryAddQuestion(8)
  tryAddQuestion(13)
  tryAddQuestion(18)
  tryAddQuestion(23)
})

console.log(
  "export const questions = " +
    JSON.stringify(questions, null, 2) +
    `
export const chapters = [
  { name: "ישראל: תעודת זהות" },
  { name: "הפסיפס הישראלי" },
  { name: "תולדות עם ישראל" },
  { name: "בימי שואה" },
  { name: "בדרך למדינה" },
  { name: "סיפורה של מדינה" },
  { name: "ביטחון ישראל" },
  { name: "תחקיר" },
  { name: "עזרה ראשונה" },
  { name: "טופוגרפיה" },
  { name: "קשר" },
  { name: "נשק" },
]
`,
)

export {}
