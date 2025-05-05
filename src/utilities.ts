import { setLocalStorage } from "./hooks"

export const canonical = "write.bahad1.com"

export const ENGLISH_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
]

export const promiseToSuccessPromise = async (p: Promise<any>) => {
  try {
    await p
    return true
  } catch (ignored) {
    return false
  }
}

// Thanks: https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
export const shuffle = (array: any[]) => {
  let currentIndex = array.length

  // While there remain elements to shuffle...
  while (currentIndex != 0) {
    // Pick a remaining element...
    let randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--

    // And swap it with the current element.
    ;[array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ]
  }
}

export const downloadUrl = (url: string, filename: string) => {
  const a = window.document.createElement("a")
  a.href = url
  a.download = filename
  a.target = "_blank"
  window.document.body.appendChild(a)
  a.click()
  window.document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const downloadBlob = (blob: Blob, filename: string) =>
  downloadUrl(URL.createObjectURL(blob), filename)

export const downloadJson = (json: any, filename: string) =>
  downloadUrl(
    `data:application/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(json, null, 4),
    )}`,
    filename,
  )

export const downloadText = (media: string, text: string, filename: string) =>
  downloadUrl(
    `data:${media};charset=utf-8,${encodeURIComponent(text)}`,
    filename,
  )

export const pad = (s: string, l: number) => {
  if (s.length < l) {
    return s.padStart(l, "0")
  }
  return s
}

export const formatMinutes = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  seconds -= minutes * 60
  seconds = Math.round(seconds)
  return `${pad(minutes.toString(), 2)}:${pad(seconds.toString(), 2)}`
}

export const arraysEqual = (a: any[], b: any[]) => {
  if (a.length !== b.length) {
    return false
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }

  return true
}

export const getLocalStorageCopy = () => {
  const localStorageCopy: any = {}
  for (let i = 0; i < localStorage.length; i++) {
    localStorageCopy[localStorage.key(i)!] = localStorage.getItem(
      localStorage.key(i)!,
    )
  }
  return localStorageCopy
}

export const setLocalStorageCopy = (data: any) => {
  localStorage.clear()
  for (const key in data) {
    setLocalStorage(key, JSON.parse(data[key]))
  }
}
