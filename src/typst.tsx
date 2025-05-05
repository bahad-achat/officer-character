import {
  createTypstCompiler,
  preloadRemoteFonts,
  TypstCompiler,
} from "@myriaddreamin/typst.ts"
import { getLocalStorage, setLocalStorage } from "./hooks"
import { JSONContent } from "@tiptap/react"
import { FontAwesomeIcon } from "./components/FontAwesome"
import { Settings } from "./pages/SettingsPage"
import { OCDocument } from "./models"
import { formatJewishDateInHebrew, toJewishDate } from "jewish-date"
import { showFailureMessage } from "./ui-utilities"
import { downloadText, ENGLISH_MONTHS } from "./utilities"
import { disableDefaultFontAssets } from "@myriaddreamin/typst.ts/dist/esm/options.init.mjs"
import { getTemplates } from "./pages/DocumentsPage"
import { offline } from "./config"
import {
  DATE_MATCHER,
  datesMustBeFull,
  debriefChronologicalOrderChecker,
  debriefLearnedChecker,
  HOUR_MATCHER,
  hoursMustBeFull,
  mustInclude,
  mustNotIncludeWord,
  onlySpecificAllowed,
  tableCellChecker,
} from "./errorChecking"
import { Anchor } from "@mantine/core"
import { renderMap } from "./maps"

export const TYPE_TO_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
}

declare global {
  interface Window {
    typstCompiler?: TypstCompiler
    fetchedImages?: Set<string>
  }
}

export const initializeTypst = async () => {
  setLocalStorage("Initializing Typst", true)
  const compiler = createTypstCompiler()
  await compiler.init({
    beforeBuild: [
      disableDefaultFontAssets(),
      preloadRemoteFonts([
        "/resources/fonts/DavidCLM-Bold.otf",
        "/resources/fonts/DavidCLM-BoldItalic.otf",
        "/resources/fonts/DavidCLM-Medium.otf",
        "/resources/fonts/DavidCLM-MediumItalic.otf",
        "/resources/fonts/DavidLibre-Bold.ttf",
        "/resources/fonts/DavidLibre-Medium.ttf",
        "/resources/fonts/DavidLibre-Regular.ttf",
      ]),
    ],
    getModule: () =>
      window.matchMedia("(display-mode: standalone)").matches || offline
        ? "/resources/typst_ts_web_compiler_bg.wasm"
        : "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@0.5.4/pkg/typst_ts_web_compiler_bg.wasm",
  })
  compiler.addSource("/lib.typ", LIBRARY_CODE)
  const pngData = await (await fetch("/logo.png")).arrayBuffer()
  compiler.mapShadow("/assets/logo.png", new Uint8Array(pngData))
  const idfLogoData = await (await fetch("/idf-logo.png")).arrayBuffer()
  compiler.mapShadow("/assets/idf-logo.png", new Uint8Array(idfLogoData))
  setLocalStorage("Initializing Typst", false)
  window.typstCompiler = compiler
}

export const typstEscape = (text: string) => {
  return "#" + JSON.stringify(text)
}

export const fetchImage = async (url: string, fname?: string) => {
  if (window.fetchedImages?.has(url)) {
    return
  }

  const r = await fetch(url)
  const v = await r.arrayBuffer()
  if (!fname) {
    fname =
      new Date().toISOString() +
      "." +
      TYPE_TO_EXTENSION[r.headers.get("Content-Type")!]
  }
  window.typstCompiler!.mapShadow("/" + fname, new Uint8Array(v))

  if (!window.fetchedImages) {
    window.fetchedImages = new Set()
  }
  window.fetchedImages.add(url)

  return fname
}

export const fetchAllImages = async (d: JSONContent) => {
  if (d.type === "image") {
    await fetchImage(d.attrs?.src ?? "", d.attrs?.alt)
  }

  const promises: Promise<void>[] = []
  for (const child of d.content ?? []) {
    promises.push(fetchAllImages(child))
  }
  await Promise.all(promises)
}

export const tiptapToTypst = (d: JSONContent): string => {
  if (d.type === "doc") {
    return d.content?.map(tiptapToTypst).join("") ?? ""
  }

  if (d.type === "image") {
    fetchImage(d.attrs?.src ?? "", d.attrs?.alt)
    return `#image(${JSON.stringify(d.attrs?.alt ?? "")})`
  }

  if (d.type === "paragraph") {
    let result = (d.content?.map(tiptapToTypst).join("") ?? "#box[]") + "\n\n"
    if (d.attrs?.textAlign && d.attrs.textAlign !== "justify") {
      result = `#align(${d.attrs.textAlign})[${result}]`
    }
    return result
  }

  if (d.type === "text") {
    let text = typstEscape(d.text ?? "")
    for (const mark of d.marks ?? []) {
      if (mark.type === "bold") {
        text = `*${text}*`
      } else if (mark.type === "italic") {
        text = `_${text}_`
      } else if (mark.type === "underline") {
        text = `#underline[${text}]`
      } else if (mark.type === "highlight") {
        text = `#highlight[${text}]`
      } else if (mark.type === "strike") {
        text = `#strike[${text}]`
      }
      if (mark.type === "link") {
        let href = mark.attrs?.href ?? ""
        if (href !== "" && !href.includes("://")) {
          href = "https://" + href
        }
        text = `#link(${JSON.stringify(href)})[${text}]`
      }
    }

    return text
  }

  if (d.type === "bulletList") {
    return (
      "#list(" +
      d.content?.map(
        (child) =>
          `list.item[${child.content?.map(tiptapToTypst).join("\n\n")}]`,
      ) +
      ")"
    )
  }

  if (d.type === "orderedList") {
    return (
      "#enum(" +
      d.content?.map(
        (child) =>
          `enum.item[${child.content?.map(tiptapToTypst).join("\n\n")}]`,
      ) +
      ")"
    )
  }

  if (d.type === "table") {
    const columnCount = d.content![0].content!.length
    return (
      `#table(columns: ${columnCount} * (1fr,),` +
      d.content
        ?.map((child) =>
          child.content
            ?.map((child) => "[" + tiptapToTypst(child) + "]")
            .join(","),
        )
        .join(",") +
      ")"
    )
  }

  if (d.type === "tableCell") {
    return d.content?.map(tiptapToTypst).join("") ?? ""
  }

  return ""
}

export interface TemplateParameter {
  name: string
  label: string
  placeholder?: string
  icon?: FontAwesomeIcon
  lines?: number
  isTypst?: boolean
  isImage?: boolean
  defaultContent?: JSONContent
  tutorial?: React.ReactNode
  variadic?: boolean
  children?: TemplateParameter[]
  errorChecker?: (v: string) => string | undefined
  typstChecker?: (v: JSONContent) => string | undefined
}

export interface TemplateButton {
  icon: FontAwesomeIcon
  label: string
  onClick: (parameters: any) => Promise<void>
}

export interface TemplateInfo {
  group: string
  name: string
  parameters: TemplateParameter[]
  color: string
  typstPreamble?: string
  postprocess?: (parameters: any) => Promise<void>
  buttons?: TemplateButton[]
}

export const TEMPLATE_GROUPS = ["כללי", "צה״לי", "בה״די"]
export const TEMPLATES: Record<string, TemplateInfo> = {
  work: {
    group: "כללי",
    name: "עבודה",
    color: "pink",
    parameters: [
      {
        name: "content",
        label: "תוכן",
        lines: 5,
        placeholder: "1. משהו מגניב\n2. משהו נוסף\n\tא. משהו",
        isTypst: true,
      },
    ],
  },
  "risk-management": {
    group: "צה״לי",
    name: "ניהול סיכונים",
    color: "cyan",
    parameters: [
      {
        name: "event-details",
        label: "פרטי אירוע",
        isTypst: true,
      },
      {
        name: "risk",
        label: "סיכון",
        variadic: true,
        children: [
          {
            name: "stage",
            label: "שלב במשימה",
            placeholder: "לפני הסיור",
            tutorial: "ביחס למופע - לפני/במהלך/אחרי האירוע",
          },
          {
            name: "danger",
            label: "סכנה",
            tutorial: "הגורם הכללי",
            placeholder: "עייפות",
          },
          {
            name: "risk",
            label: "סיכון",
            tutorial: "הדבר הספציפי שנובע מהסכנה",
            placeholder: "תאונה",
          },
          {
            name: "cause-5m",
            label: "גורם 5M",
            tutorial: "מקום, משימה, פו״ש, אדם, אמל״ח",
          },
          {
            name: "probability-1",
            label: "סבירות ראשונה",
            errorChecker: (v) =>
              onlySpecificAllowed(v, ["ז'", "ג'", "ב'", "נ'"]),
            tutorial: "זניחה, נמוכה, בינונית או גבוהה",
          },
          {
            name: "danger-level-1",
            label: "חומרה ראשונה",
            errorChecker: (v) => onlySpecificAllowed(v, ["A", "B", "C"]),
            tutorial: "קל, בינוני, חמור",
          },
          {
            name: "assessment-1",
            label: "הערכת סיכון ראשונה",
            errorChecker: (v) =>
              onlySpecificAllowed(
                v,
                ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
                "הערכת הסיכון חייבת להיות בין 0-10!",
              ),
            tutorial: "מחושב לפי הסבירות והחומרה על פי הטבלה",
          },
          {
            name: "preventive-measures",
            label: "פעילות מתקנת",
            placeholder: "הקפדה על שעות מנוחה ושינה",
          },
          {
            name: "probability-2",
            label: "סבירות שנייה",
            tutorial: "זניחה, נמוכה, בינונית או גבוהה",
            errorChecker: (v) =>
              onlySpecificAllowed(v, ["ז'", "ג'", "ב'", "נ'"]),
          },
          {
            name: "danger-level-2",
            label: "חומרה שנייה",
            errorChecker: (v) => onlySpecificAllowed(v, ["A", "B", "C"]),
            tutorial: "קל, בינוני, חמור. החומרה לא תשתנה לאחר פעילות מתקנת!",
          },
          {
            name: "assessment-2",
            label: "הערכת סיכון שנייה",
            errorChecker: (v) =>
              onlySpecificAllowed(
                v,
                ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
                "הערכת הסיכון חייבת להיות בין 0-10!",
              ),
            tutorial: "מחושב לפי הסבירות והחומרה על פי הטבלה",
          },
          {
            name: "responsible",
            label: "אחראי/ת לביצוע",
            tutorial: "נרצה להיות ספציפיים!",
          },
        ],
      },
    ],
  },
  debrief: {
    group: "צה״לי",
    name: "תחקיר",
    color: "blue",
    parameters: [
      {
        name: "event-moed",
        label: "מועד האירוע",
        icon: "clock",
        placeholder: "ד׳ במרחשוון התשפ״ה, ה-05/11/2024, בשעה 09:15.",
        tutorial: "תאריך לועזי, עברי ושעה.",
        errorChecker: (v) =>
          hoursMustBeFull(v) ??
          datesMustBeFull(v) ??
          mustInclude(
            v,
            new RegExp(HOUR_MATCHER),
            "צריך לכלול את השעה, למשל 08:00.",
          ) ??
          mustInclude(
            v,
            new RegExp(DATE_MATCHER),
            "צריך לכלול את התאריך הלועזי, למשל 27/04/2025",
          ),
      },
      {
        name: "event-location",
        label: "מקום האירוע",
        icon: "location-dot",
        tutorial: "בסיס, יחידה וכו׳.",
      },
      {
        name: "event-description",
        label: "תיאור האירוע",
        icon: "paragraph",
        tutorial:
          "תיאור כללי (פליטת כדור, מטווחים, מכת חום, הפקרת נשק). התיאור חייב להיות תמציתי, טכני וממוקד מבלי לפרט יתר על המידה כך שהקורא יבין באופן כללי בלבד את אשר אירע ובמידת הצורך יחליט באם ברצונו להעמיק את קריאתו בתחקיר.",
      },
      {
        name: "event-results",
        label: "תוצאות האירוע",
        icon: "circle-exclamation",
        tutorial:
          "האם היו נפגעים ומה הנזק (ציון נפגעים/נזק לרכוש - א.נ.א.נ. למשל).",
      },
      {
        name: "event-participants",
        label: "משתתפים בתחקיר",
        icon: "user-group",
        isTypst: true,
        tutorial:
          "שם מלא, דרגה, מספר אישי. יש לרשום את משתתפי התחקיר ברשימה - אחד מתחת לשני. יש לרשום מיהו הגורם המתחקר הראשי (בעל הדרגה הבכירה בתחקיר).",
        errorChecker: (v) =>
          mustInclude(
            v,
            /מתחקר.*ראשי.?/,
            "יש להגדיר מתחקר/ת ראשי/ת לתחקיר! לא מצאתי ״מתחקר ראשי״ או ״מתחקרת ראשית״, אנא וודאו שנית.",
          ),
      },
      {
        name: "background",
        label: "ממצאי רקע",
        lines: 3,
        tutorial:
          "תיאור כללי של מידע המציין את ממצאי המסגרת כרקע לתיאור האירוע. התיאור הינו מצומצם וחיוני להבנת הרצף הכרונולוגי ובלעדיו לא ניתן להבין את ההתרחשות.",
        isTypst: true,
      },
      {
        name: "chronological-order",
        label: "רצף כרונולוגי",
        lines: 3,
        tutorial:
          "תיאור עובדתי של ההרחשויות באירוע על פי הסדר הכרונולוגי עם תאריך כל פעם שמשתנה ושעה בכל סעיף. על כותב/ת התחקיר לתת תיאור מלא של רצף ההתרחשות.",
        isTypst: true,
        typstChecker: debriefChronologicalOrderChecker,
      },
      {
        name: "additional-background",
        label: "ממצאים נוספים",
        lines: 3,
        tutorial:
          "ממצאים שלא ידענו בזמן האירוע, או שלא קרו בסדר הכרונולוגי אך מצביעים על תהליכים הקשורים לתוצאות האירוע. יש חשיבות לציינם על מנת לתמוך במסקנות.",
        isTypst: true,
      },
      {
        name: "causes",
        label: "גורמים",
        lines: 3,
        tutorial: (
          <span>
            ליבת התחקיר. המסקנות הינן התוצר של סיכום הממצאים.{" "}
            <b>יש לכתוב בזמן הווה!</b>
            <br />
            גורם ישיר - קביעת הגורם שגרם באופן מיידי לאירוע הבטיחות (בדרך כלל
            שגיאה או תקלה) גורם עקיף - התנאים והנסיבות שאפשרו, תרמו או השפיעו על
            האירוע
          </span>
        ),
        isTypst: true,
        errorChecker: (v) =>
          mustNotIncludeWord(
            v,
            "היה",
            "מסקנות צריכות להיות מנוסחות בזמן הווה! מצאתי את המילה ׳היה׳, אנא וודאו שניסחתם בזמן הווה.",
          ),
      },
      {
        name: "mistakes",
        label: "תקלות ושגיאות",
        lines: 3,
        tutorial: (
          <span>
            תקלה - אי ביצוע נכון של משימה כתוצאה מחריגה של פקודה או הנחייה.
            <br />
            שגיאה - אי ביצוע נכון של משימה כתוצאה מטעות בשיקול דעת.
          </span>
        ),
        isTypst: true,
        errorChecker: (v) =>
          mustNotIncludeWord(
            v,
            "היה",
            "מסקנות צריכות להיות מנוסחות בזמן הווה! מצאתי את המילה ׳היה׳, אנא וודאו שניסחתם בזמן הווה.",
          ),
      },
      {
        name: "notable-mentions",
        label: "נק׳ ראויות לציון",
        lines: 3,
        isTypst: true,
        tutorial: "מסקנות חיוביות לשימור - נדרש בכל תחקיר.",
        errorChecker: (v) =>
          mustNotIncludeWord(
            v,
            "היה",
            "מסקנות צריכות להיות מנוסחות בזמן הווה! מצאתי את המילה ׳היה׳, אנא וודאו שניסחתם בזמן הווה.",
          ),
      },
      {
        name: "learned",
        label: "לקחים",
        lines: 3,
        tutorial: (
          <span>
            תכלית התחקיר. מימוש המסקנות לצורך תיקון ליקוי או מילוי של חסר על מנת
            ליצור מניעה עתידית של תאונות ותקריות. הלקחים יהיו אפקטיביים ויביאו
            לחלופה טובה ובטוחה.
            <br />
            <b>
              יש לקבוע מסגרת לוח זמנים ברורה -{" "}
              <u>אחראי/ת ותג״ב, מודגשים ועם קו תחתון</u>.
            </b>
          </span>
        ),
        isTypst: true,
        placeholder:
          "1. על מוביל הסיור לוודא שליטה בכוח אדם והימצאות נשקים אצל צוערי הצוות בכל מעבר מקום בסיור. באחריות מוביל הסיור, שוטף.",
        typstChecker: debriefLearnedChecker,
      },
      {
        name: "suggestions",
        label: "המלצות",
        lines: 3,
        tutorial:
          "הלקחים שאין ביכולת ובסמכות המתחקר ליישם. תחקיר של מפקד שבו יש המלצות לרמה הממונה ללא לקחים הוא בעייתי, שכן מטרת התחקיר ליצור למידה ברמת המתחקר ומטה.",
        isTypst: true,
        placeholder:
          "1. ממליץ לבצע נוהל ״צהוב בעיניים״ בכל עלייה על אוטובוס כחלק מאחריות השליטה בכוח האדם והציוד.",
      },
    ],
  },
  "plan-approval": {
    group: "בה״די",
    name: "אישור תוכניות",
    color: "teal",
    parameters: [
      {
        name: "main-mission",
        label: "מה היא משימתך העיקרית בהתנסות? איך את/ה תופס/ת אותה?",
        lines: 3,
      },
      {
        name: "responsibility",
        label: "מה נמצא תחת אחריותך לאור הגדרת התפקיד בהתנסות ומרכיביו?",
        lines: 2,
      },
      { name: "success", label: "מה תגדיר/י כהצלחה במשימה?", lines: 1 },
      {
        name: "why",
        label: "למה את/ה חושב/ת שקיבלת את ההתנסות?",
        lines: 2,
      },
      { name: "target-1", label: "מטרה 1", lines: 1 },
      { name: "goal-1", label: "יעד 1 (למטרה 1)", lines: 1 },
      { name: "challenge-1", label: "אתגר בעמידה ביעד 1", lines: 1 },
      {
        name: "how-1",
        label: "איך אדע אם יעד 1 מקדם אותי למטרה?",
        lines: 1,
      },
      {
        name: "goal-2",
        label: "יעד 2 (למטרה 1)",
        lines: 1,
        placeholder: "יעד נוסף למטרה 1",
      },
      { name: "challenge-2", label: "אתגר בעמידה ביעד 2", lines: 1 },
      {
        name: "how-2",
        label: "איך אדע אם יעד 2 מקדם אותי למטרה?",
        lines: 1,
      },

      { name: "target-2", label: "מטרה 2", lines: 1 },
      { name: "goal-3", label: "יעד 3 (למטרה 2)", lines: 1 },
      { name: "challenge-3", label: "אתגר בעמידה ביעד 3", lines: 1 },
      {
        name: "how-3",
        label: "איך אדע אם יעד 3 מקדם אותי למטרה?",
        lines: 1,
      },
      {
        name: "goal-4",
        label: "יעד 4 (למטרה 2)",
        lines: 1,
        placeholder: "יעד נוסף למטרה 2",
      },
      { name: "challenge-4", label: "אתגר בעמידה ביעד 4", lines: 1 },
      {
        name: "how-4",
        label: "איך אדע אם יעד 4 מקדם אותי למטרה?",
        lines: 1,
      },

      { name: "target-3", label: "מטרה 3", lines: 1 },
      { name: "goal-5", label: "יעד 5 (למטרה 3)", lines: 1 },
      { name: "challenge-5", label: "אתגר בעמידה ביעד 5", lines: 1 },
      {
        name: "how-5",
        label: "איך אדע אם יעד 5 מקדם אותי למטרה?",
        lines: 1,
      },
      {
        name: "goal-6",
        label: "יעד 6 (למטרה 3)",
        lines: 1,
        placeholder: "יעד נוסף למטרה 3",
      },
      { name: "challenge-6", label: "אתגר בעמידה ביעד 6", lines: 1 },
      {
        name: "how-6",
        label: "איך אדע אם יעד 6 מקדם אותי למטרה?",
        lines: 1,
      },

      {
        name: "challenges",
        label: "מה יהיו נקודות האתגר שלך במשימה?",
        lines: 2,
      },
      {
        name: "strengths-and-weaknesses",
        label:
          "כיצד החוזקות שלך יבואו לידי ביטוי בביצוע המשימה? כיצד הן מסייעות לך להתגבר על נקודות האתגר שלך?",
        lines: 2,
      },
      {
        name: "team-state",
        label:
          "מה מצב הצוות בנקודת זמן זו? מה הצוות צריך כדי לצלוח את המשימה? התייחס/י לנקודות האתגר והחוזקה של הצוות",
        lines: 2,
      },
      {
        name: "my-context",
        label:
          "באילו תנאים תקיים/י את ההתנסות? (לדוגמה, מצב הצוות/פלוגה, נושא השבוע, תורנויות)",
        lines: 2,
      },
      {
        name: "relevant-context",
        label:
          "מה בסביבה עלול לסייע לך ומה עשוי לעכב אותך בהצלחתך? (התייחס/י לכל גורם משפיע)",
        lines: 2,
      },
    ],
  },
  "plan-approval-instructional": {
    group: "בה״די",
    name: "אישור תוכניות הדרכתיות",
    color: "green",
    parameters: [
      {
        name: "main-mission",
        label: "מה היא משימתך העיקרית בהתנסות? איך את/ה תופס/ת אותה?",
        lines: 3,
      },
      {
        name: "responsibility",
        label: "מה נמצא תחת אחריותך לאור הגדרת התפקיד בהתנסות ומרכיביו?",
        lines: 2,
      },
      { name: "success", label: "מה תגדיר/י כהצלחה במשימה?", lines: 1 },
      {
        name: "why",
        label: "למה את/ה חושב/ת שקיבלת את ההתנסות?",
        lines: 2,
      },
      { name: "target-1", label: "מטרה 1", lines: 1 },
      { name: "goal-1", label: "יעד 1", lines: 1 },
      { name: "challenge-1", label: "אתגר בעמידה ביעד 1", lines: 1 },
      {
        name: "how-1",
        label: "איך אדע אם יעד 1 מקדם אותי למטרה?",
        lines: 1,
      },
      { name: "goal-2", label: "יעד 2", lines: 1 },
      { name: "challenge-2", label: "אתגר בעמידה ביעד 2", lines: 1 },
      {
        name: "how-2",
        label: "איך אדע אם יעד 2 מקדם אותי למטרה?",
        lines: 1,
      },

      { name: "target-2", label: "מטרה 2", lines: 1 },
      { name: "goal-3", label: "יעד 3", lines: 1 },
      { name: "challenge-3", label: "אתגר בעמידה ביעד 3", lines: 1 },
      {
        name: "how-3",
        label: "איך אדע אם יעד 3 מקדם אותי למטרה?",
        lines: 1,
      },
      { name: "goal-4", label: "יעד 4", lines: 1 },
      { name: "challenge-4", label: "אתגר בעמידה ביעד 4", lines: 1 },
      {
        name: "how-4",
        label: "איך אדע אם יעד 4 מקדם אותי למטרה?",
        lines: 1,
      },

      { name: "target-3", label: "מטרה 3", lines: 1 },
      { name: "goal-5", label: "יעד 5", lines: 1 },
      { name: "challenge-5", label: "אתגר בעמידה ביעד 5", lines: 1 },
      {
        name: "how-5",
        label: "איך אדע אם יעד 5 מקדם אותי למטרה?",
        lines: 1,
      },
      { name: "goal-6", label: "יעד 6", lines: 1 },
      { name: "challenge-6", label: "אתגר בעמידה ביעד 6", lines: 1 },
      {
        name: "how-6",
        label: "איך אדע אם יעד 6 מקדם אותי למטרה?",
        lines: 1,
      },

      {
        name: "challenges",
        label: "מה יהיו נקודות האתגר שלך במשימה?",
        lines: 2,
      },
      {
        name: "strengths-and-weaknesses",
        label:
          "כיצד החוזקות שלך יבואו לידי ביטוי בביצוע המשימה? כיצד הן מסייעות לך להתגבר על נקודות האתגר שלך?",
        lines: 2,
      },
      {
        name: "team-state",
        label:
          "מה מצב הצוות בנקודת זמן זו? מה הצוות צריך כדי לצלוח את המשימה? התייחס/י לנקודות האתגר והחוזקה של הצוות",
        lines: 2,
      },
      {
        name: "my-context",
        label:
          "באילו תנאים תקיים/י את ההתנסות? (לדוגמה, מצב הצוות/פלוגה, נושא השבוע, תורנויות)",
        lines: 2,
      },
      {
        name: "relevant-context",
        label:
          "מה בסביבה עלול לסייע לך ומה עשוי לעכב אותך בהצלחתך? (התייחס/י לכל גורם משפיע)",
        lines: 2,
      },
      { name: "content-opening", label: "תוכן מועבר - פתיחה", lines: 2 },
      { name: "time-opening", label: "זמן מוקצה - פתיחה", lines: 1 },
      { name: "elements-opening", label: "עזרי הדרכה - פתיחה", lines: 2 },
      { name: "content-body", label: "תוכן מועבר - גוף", lines: 2 },
      { name: "time-body", label: "זמן מוקצה - גוף", lines: 1 },
      { name: "elements-body", label: "עזרי הדרכה - גוף", lines: 2 },
      { name: "content-end", label: "תוכן מועבר - סיכום", lines: 2 },
      { name: "time-end", label: "זמן מוקצה - סיכום", lines: 1 },
      { name: "elements-end", label: "עזרי הדרכה - סיכום", lines: 2 },
      { name: "general-question", label: "שאלה כללית", lines: 2 },
      { name: "advancing-questions", label: "שאלות מקדמות", lines: 2 },
      { name: "arguments-for", label: "טיעונים בעד", lines: 3 },
      { name: "arguments-against", label: "טיעונים נגד", lines: 3 },
    ],
  },
  "post-experience-debrief": {
    group: "בה״די",
    name: "תחקור עצמי לאחר התנסות",
    color: "lime",
    parameters: [
      {
        name: "experience-summary",
        label: "סכם/י במילים שלך כיצד חווית את ההתנסות?",
        lines: 3,
      },
      {
        name: "details",
        label: "פירוט",
        lines: 5,
        tutorial: (
          <>
            <p>ציין/י אתגר שהתמודדת איתו בהצלחה, באילו חוזקות השתמשת?</p>
            <p>ציין/י אתגר איתו היית רוצה להתמודד אחרת.</p>
            <p>
              מה היו היעדים שבחרת לעסוק בהם עם קבלת ההתנסות? האם התמודדת עמם
              וחיזקת אותם? כיצד?
            </p>
            <p>נקודות חדשות שלמדת על עצמך.</p>
            <p>נקודות חדשות שלמדת על הצוות.</p>
            <p>
              איך תפיסת הפיקוד שלך באה לידי ביטוי בהתנסות? (הוסף/הוסיפי ציטוטים
              מתפיסת הפיקוד). האם ואיך התחדדה תפיסת הפיקוד שלך? פרט/י.
            </p>
          </>
        ),
      },
      {
        name: "future",
        label:
          "פרט/י מה תיקח/י הלאה לתפקידך העתידי כקצין/ה מתוך התנהלותך במהלך ההתנסות.",
        lines: 3,
      },
      {
        name: "tips",
        label: "דגשים למתנסים הבאים (מינימום 3 טיפים לבא/ה אחריך).",
        lines: 3,
      },
      { name: "summary", label: "סיכום", lines: 3 },
    ],
  },
  "organization-order": {
    group: "צה״לי",
    name: 'פק"א',
    color: "indigo",
    parameters: [
      {
        name: "general",
        label: "כללי",
        isTypst: true,
        placeholder:
          "1. בבה״ד 1 מתנהל ענף ההדרכה התומך בגדודים מדי שנה.\n2. בתאריך 18/12/2024, יתקיים סיור עבור קציני הענף במכתש רמון.",
        tutorial:
          "צריך לכלול את הפרטים הבאים: מועד האירוע, מקום האירוע, המשתתפים ברשימה ממוספרת, מפקד האירוע ופירוט כללי של הרעיון.",
      },
      {
        name: "goals",
        label: "מטרות",
        isTypst: true,
        placeholder:
          "1. כלל הקצינים בענף יעברו העשרה בנושא חנוכה.\n2. כלל הקצינים בענף יתגבשו בעקבות הטיול - חוויה שוברת שגרה.",
        tutorial: "התוצאות שאני מעוניינ/ת להשיג",
      },
      {
        name: "method",
        label: "שיטה",
        isTypst: true,
        placeholder: "1. הגעה באמצעות הסעות מהבסיס.\n2. הדלקת נרות משותפת.",
        tutorial: "כיצד אבצע את המופע",
      },
      {
        name: "rationale",
        label: "רציונאל",
        isTypst: true,
        tutorial: "מדוע אבצע את המופע",
        placeholder:
          "1. מפקד שמרגיש כי משקיעים בו ישקיע בחייליו.\n2. חשוב שנעצים תחושה זו אצל קציני הענף.",
      },
      {
        name: "schedule",
        label: 'משבצת לו"ז עקרוני',
        variadic: true,
        children: [
          {
            name: "hours",
            label: "שעות",
            placeholder: "07:45-07:55",
            errorChecker: (v) => hoursMustBeFull(v),
          },
          {
            name: "content",
            label: "תוכן",
            placeholder: "יציאה מהבסיס - נסיעה למכתש רמון",
            isTypst: true,
            typstChecker: tableCellChecker,
          },
          { name: "responsible", label: "גורם מעביר", placeholder: "מד״ר" },
          {
            name: "notes",
            label: "הערות",
            placeholder: "יש לתאם הסעות",
            isTypst: true,
            typstChecker: tableCellChecker,
          },
        ],
      },
      {
        name: "responsibilities",
        label: "חלוקת אחריות",
        variadic: true,
        children: [
          { name: "responsible", label: "גורם אחראי", placeholder: "קל״ג" },
          {
            name: "content",
            label: "תוכן",
            placeholder: "תיאום הובלות",
            isTypst: true,
            typstChecker: tableCellChecker,
          },
          {
            name: "notes",
            label: "הערות",
            placeholder: "יש להיעזר בקצינים נוספים",
            isTypst: true,
            typstChecker: tableCellChecker,
          },
        ],
      },
      {
        name: "highlights",
        label: "דגשים",
        isTypst: true,
        placeholder:
          "1. הסיור יתבצע על אזרחי.\n2. יש להצטייד בביגוד חם עקב מזג האוויר.",
      },
    ],
  },
  "meeting-plan": {
    group: "צה״לי",
    name: "מצע לדיון",
    color: "grape",
    parameters: [
      { name: "meeting-date", label: "תאריך הדיון" },
      { name: "meeting-title", label: "נושא הדיון" },
      { name: "meeting-target", label: "מטרת הדיון" },
      { name: "meeting-leader", label: "מוביל/ת הדיון" },
      { name: "meeting-duration", label: "משך הדיון" },
      { name: "meeting-location", label: "מיקום הדיון" },
      { name: "meeting-invitees", label: "מוזמנים", isTypst: true },
      {
        name: "meeting-schedule",
        label: "משבצת לוח זמנים",
        variadic: true,
        children: [
          { name: "subject", label: "נושא" },
          { name: "leader", label: "מוביל/ה" },
          { name: "participants", label: "משתתפים" },
          { name: "time", label: "זמן" },
        ],
      },
      {
        name: "meeting-responsibilities",
        label: "תחומי אחריות",
        isTypst: true,
      },
      { name: "meeting-highlights", label: "דגשים", lines: 3, isTypst: true },
    ],
  },
  "meeting-summary": {
    group: "צה״לי",
    name: "סיכום דיון",
    color: "violet",
    parameters: [
      { name: "meeting-date", label: "תאריך הדיון" },
      { name: "meeting-title", label: "נושא הדיון" },
      { name: "meeting-purpose", label: "מהות הדיון" },
      { name: "meeting-participants", label: "המשתתפים בדיון", isTypst: true },
      {
        name: "meeting-summary-and-tasks",
        label: "סיכום מפקד וחלוקת אחריות",
        isTypst: true,
      },
    ],
  },
  "simulation-processing": {
    group: "בה״די",
    name: "עיבוד סימולציה",
    color: "yellow",
    parameters: [
      { name: "name", label: "שם המסומלצ/ת" },
      {
        name: "simulation-type",
        label: "סוג הסימולציה",
        tutorial: "עיבוד אישי/עיבוד צוותי/סימולציה מתפרצת",
      },
      { name: "feeling", label: "איך הרגשת במהלך ביצוע הסימולציה?" },
      {
        name: "challenge",
        label: "שתפ/י בנקודת אתגר שלך לאורך ביצוע הסימולציה.",
      },
      {
        name: "strength",
        label: "שתפ/י בנקודת חוזק שלך לאורך ביצוע הסימולציה.",
      },
      { name: "satisfied", label: "האם את/ה מרוצה מהאופן בו פעלת?" },
      { name: "would-change", label: "מה היית עושה באופן אחר?" },
      {
        name: "leader-perception",
        label: "האם תפיסתך הפיקודית באה לידי ביטוי? אם כן, באיזה אופן?",
      },
      { name: "conclusions", label: "מהן המסקנות שלך מביצוע הסימולציה?" },
      {
        name: "tools",
        label:
          "אם מדובר בסימולציה בעיבוד צוותי - שתפ/י בכלים אשר קיבלת מהצוות במהלך עיבוד הסימולציה.",
      },
    ],
  },
  "letter-in-memory": {
    name: "מסמך להנצחת נופל",
    group: "בה״די",
    color: "#7e0c2b",
    parameters: [
      {
        name: "person-name",
        label: "שם הנופל",
        tutorial: (
          <>
            <p>אל מג״ד, דע מ״פ.</p>
            <p>הנדון: ״מגש הכסף״ - סרן ישראלה ישראלי</p>
          </>
        ),
      },
      {
        name: "introduction-line",
        label: "שורת פתיחה",
        isTypst: true,
        placeholder:
          "סרן ישראל ישראלי נולד ב-29.12.2001 במודיעין-מכבים-רעות, היה מפק״ץ בסיירת גולני, נפל בקרב ב-03.03.2024...",
      },
      {
        name: "leading-values",
        label: "ערכים מובילים",
        isTypst: true,
        placeholder: "3 ערכים",
      },
      { name: "person-quote", label: "ציטוט", isTypst: true },
      { name: "is-male", label: "זכר?", placeholder: "כן" },
      { name: "rank", label: "דרגה", placeholder: "סרן" },
      {
        name: "photo",
        label: "קישור לתמונה",
        tutorial: "מומלץ קישור מאתר יזכור, לא כל האתרים נתמכים",
        isImage: true,
      },
      {
        name: "submitters",
        label: "מגישים",
        placeholder: "צוער מישהו, צוערת מישהו\nפלוגת גולן",
        lines: 3,
      },
    ],
  },
  "cadet-tutors-cadet-feedback": {
    name: "משוב התנסות - צוער חונך צוער",
    group: "בה״די",
    color: "#6C6874",
    parameters: [
      {
        name: "phenomena",
        label: "תופעה",
        variadic: true,
        children: [
          { name: "axis", label: "ציר", tutorial: "מנהיגות/ערכים/מקצועיות" },
          { name: "name", label: "שם התופעה" },
          { name: "explanation", label: "הסבר קצר על התופעה" },
          {
            name: "examples",
            label: "דוגמאות לתופעה (לפחות 2)",
            isTypst: true,
          },
          {
            name: "importance",
            label: "חשיבות התופעה לקצין בצבא ההגנה לישראל",
          },
          { name: "extras", label: "נוסף" },
        ],
      },
      {
        name: "overview",
        label: "הערכה כללית על ההתנסות",
        isTypst: true,
      },
    ],
  },
  "middle-review": {
    name: "תחקור עצמי - הכוונה לחוו״ד אמצע",
    group: "בה״די",
    color: "#642424",
    parameters: [
      {
        name: "general-feelings",
        label:
          "תחושות כלליות: איך עוברת עליי ההכשרה? (תכנים, לו״ז, מעטפת, תחושות כלליות)",
      },
      {
        name: "personal-goals",
        label:
          "התייחסויות ליעדים האישיים שנקבעו בתחילת ההכשרה ואיפה אני מרגיש/ה שאני עומד/ת מולם?",
        isTypst: true,
      },
      { name: "good", label: "3 שימורים לעצמי", isTypst: true },
      { name: "bad", label: "3 שיפורים לעצמי", isTypst: true },
      { name: "feeling-in-group", label: "איך אני מרגיש/ה בפלוגה ובצוות?" },
      {
        name: "feeling-officers",
        label: "איך אני מרגיש/ה אל מול הסגל (מפק״ץ/מ״פ)?",
      },
      {
        name: "important-moment",
        label: "רגע או תוכן בהכשרה שהיו משמעותיים עבורי",
      },
      {
        name: "future-tasks",
        label: "דיוק יעדים להמשך: במה אני הולכ/ת להתמקד בהמשך הדרך?",
      },
      { name: "notes", label: "התייחסויות נוספות", isTypst: true },
    ],
  },
  "safra-veseifa": {
    name: "ספרא וסייפא",
    group: "בה״די",
    color: "#C1876B",
    parameters: [
      { name: "book-name", label: "שם הספר (לעמוד שער)" },
      {
        name: "author-hierarchy",
        label: "גדוד, פלוגה וצוות",
        placeholder: "גדוד ארז, פלוגת גולן, צוות 10",
      },
      {
        name: "book-cover",
        label: "קישור לתמונה של כריכת הספר (לעמוד שער)",
        tutorial: "ייתכן שחלק מהקישורים לא יעבדו בגלל מגבלות אבטחת רשת",
        isImage: true,
      },
      {
        name: "question-1",
        label: "שאלה 1",
        tutorial:
          "ספר/י בקצרה (3-4 שורות) אודות המנהיג/ה עליו סופר בספר. תאר/י נוכח סיפורו של מנהיג זה מהו מנהיג לתפיסתך? איזה מנהיג את/ה רוצה להיות? ספר/י חוויה מנהיגותית שחווית או על מנהיג/ה שפגשת בשירותך ופרט/י אודותיהם.",
        lines: 4,
        isTypst: true,
      },
      {
        name: "question-2",
        label: "שאלה 2",
        tutorial:
          "ספר/י בקצרה (3-4 שורות) על דילמה ערכית/התנגשות בין ערכים שחווה המנהיג בספר שקראת. נתח/י אותה על פי משולש המנהיגות והבע/י את דעתך על אירוע זה. האם היית נוהג/ת אחרת? אם כן - כיצד? אם לא - מדוע? האם חווית חוויה דומה בשירותך? האם את/ה יכולים לחוות חוויה דומה? במידה וכן - כיצד תנהגו?",
        lines: 4,
        isTypst: true,
      },
      {
        name: "question-3",
        label: "שאלה 3",
        tutorial:
          "ספר/י בקצרה (3-4 שורות) על דילמה ערכית/התנגשות בין ערכים שחווה המנהיג בספר שקראת. נתח/י את האירוע על פי ערכי רוח צה״ל. איזה ערכים מתנגשים לתפיסתך? מדוע? האם היית מבצע בחירה אחרת? אם כן - כיצד? אם לא - מדוע?",
        lines: 4,
        isTypst: true,
      },
      {
        name: "question-4",
        label: "שאלה 4",
        tutorial:
          "עם אילו תובנות חדשות יצאת ביחס לתפיסת הפיקוד שלך נוכח קריאת הספר?",
        lines: 5,
        isTypst: true,
      },
      {
        name: "question-5",
        label: "שאלה 5",
        tutorial:
          "לדעתך - שלב/י נימה אישית וחוויות שחווית - מה הופך מנהיג למנהיג?",
        lines: 5,
        isTypst: true,
      },
    ],
  },
  "opinion-paper": {
    name: "נייר מטה",
    group: "צה״לי",
    color: "#E63244",
    parameters: [
      {
        name: "introduction",
        label: "מבוא",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "background",
        label: "רקע",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "problem-definition",
        label: "הגדרת הבעיה",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "topic",
        label: "נושא העמ״ט",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "objectives",
        label: "מטרות העמ״ט",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "base-assumptions",
        label: "הנחות יסוד",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "work-assumptions",
        label: "הנחות עבודה",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "methods",
        label: "שיטות עבודה",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "alternatives",
        label: "הצגת החלופות (3 דפ״אות)",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "alternative-analysis-a",
        label: "ניתוח החלופות והשוואה ביניהן - שיטה א׳",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "conclusions-a",
        label: "מסקנות ופתרונות - שיטה א׳",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "alternative-analysis-b",
        label: "ניתוח החלופות והשוואה ביניהן - שיטה ב׳",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "conclusions-b",
        label: "מסקנות ופתרונות - שיטה ב׳",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "sensitivity",
        label: "ניתוח רגישות",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "recommendations",
        label: "המלצות",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "conclusion",
        label: "סיכום",
        isTypst: true,
        placeholder: "1. תתחילו לכתוב!",
      },
      {
        name: "bibliography",
        label: "ביבליוגרפיה",
        isTypst: true,
      },
    ],
  },
  "form-24": {
    name: "נספח 24",
    group: "צה״לי",
    color: "#287233",
    parameters: [
      { name: "event-date", label: "תאריך המטווח" },
      { name: "fire-area", label: "שטח אש" },
      { name: "staff-count", label: "סד״כ סגל" },
      { name: "soldiers-count", label: "סד״כ חיילים" },
      { name: "ratio", label: "יחס חניכה במטווח" },
      { name: "outdoor-ratio", label: "חניכה בחצר האחורית" },
      {
        name: "expected-weather",
        label: "מז״א צפוי",
        tutorial: (
          <>
            ערך מספרי ע"פ טבלת עומסי חום/קור{" "}
            <Anchor
              style={{ fontSize: "inherit" }}
              href="https://safety.idf.il/safetyliterature"
              target="_blank"
            >
              בהוראה 5.3 – כרך א
            </Anchor>
          </>
        ),
      },
      {
        name: "required-preparations",
        label: "הכנות וציוד נדרש",
        tutorial: (
          <>
            בהתאם למגבלות ותנאי עומס חום/קור
            <Anchor
              style={{ fontSize: "inherit" }}
              href="https://safety.idf.il/safetyliterature"
              target="_blank"
            >
              בהוראה 5.3 – כרך א
            </Anchor>
          </>
        ),
      },
      {
        name: "required-approvals",
        label: "מגבלות ואישורים נדרשים",
        tutorial: (
          <>
            בהתאם למגבלות ותנאי עומס חום/קור
            <Anchor
              style={{ fontSize: "inherit" }}
              href="https://safety.idf.il/safetyliterature"
              target="_blank"
            >
              בהוראה 5.3 – כרך א
            </Anchor>
          </>
        ),
      },
      {
        name: "neighbor-forces",
        label: "כוחות שכנים",
        variadic: true,
        children: [
          { name: "name", label: "שם הכוח" },
          { name: "frequency", label: "אות קריאה וקשר" },
          { name: "location", label: "מיקומו" },
          { name: "borders", label: "התניות, ג״ג" },
          { name: "notes", label: "הערות" },
        ],
      },
      { name: "driver-phone", label: "טלפון רכב ונהג פינוי" },
      { name: "paramedic-phone", label: "טלפון חובש/ת תורנ/ית בשטח" },
      { name: "evacuation-destination", label: "פרטי יעד פינוי" },
      { name: "health-conditions", label: "פרטי כשירות רפואית של החיילים" },
      { name: "pod-scan", label: "פרטי סריקת נפלים - מי? מתי?" },
      { name: "emergency-squad", label: "פרטי אבטחת אמת (כ״כ)" },
      {
        name: "training-framework",
        label: "המסגרת המאמנת",
        tutorial:
          "לדוגמה: סגל פלוגת כרמל יוצא למטווחים לצורך התמקצעות בתוכן המועבר בטירונות.",
      },
      {
        name: "staff-status",
        label: "מצב הסגל",
        tutorial: "חסרים/ חולים, מחזור ראשון/מס' מחזור.",
      },
      { name: "neighbor-forces-status", label: "מצב כוחות שכנים" },
      { name: "equipment-status", label: "מצב ציוד" },
      {
        name: "risk",
        label: "סיכון",
        variadic: true,
        children: [
          {
            name: "stage",
            label: "שלב במשימה",
            placeholder: "לפני הסיור",
            tutorial: "ביחס למופע - לפני/במהלך/אחרי האירוע",
          },
          {
            name: "danger",
            label: "סכנה",
            tutorial: "הגורם הכללי",
            placeholder: "עייפות",
          },
          {
            name: "risk",
            label: "סיכון",
            tutorial: "הדבר הספציפי שנובע מהסכנה",
            placeholder: "תאונה",
          },
          {
            name: "cause-5m",
            label: "גורם 5M",
            tutorial: "מקום, משימה, פו״ש, אדם, אמל״ח",
          },
          {
            name: "probability-1",
            label: "סבירות ראשונה",
            errorChecker: (v) =>
              onlySpecificAllowed(v, ["ז'", "ג'", "ב'", "נ'"]),
            tutorial: "זניחה, נמוכה, בינונית או גבוהה",
          },
          {
            name: "danger-level-1",
            label: "חומרה ראשונה",
            errorChecker: (v) => onlySpecificAllowed(v, ["A", "B", "C"]),
            tutorial: "קל, בינוני, חמור",
          },
          {
            name: "assessment-1",
            label: "הערכת סיכון ראשונה",
            errorChecker: (v) =>
              onlySpecificAllowed(
                v,
                ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
                "הערכת הסיכון חייבת להיות בין 0-10!",
              ),
            tutorial: "מחושב לפי הסבירות והחומרה על פי הטבלה",
          },
          {
            name: "preventive-measures",
            label: "פעילות מתקנת",
            placeholder: "הקפדה על שעות מנוחה ושינה",
          },
          {
            name: "probability-2",
            label: "סבירות שנייה",
            tutorial: "זניחה, נמוכה, בינונית או גבוהה",
            errorChecker: (v) =>
              onlySpecificAllowed(v, ["ז'", "ג'", "ב'", "נ'"]),
          },
          {
            name: "danger-level-2",
            label: "חומרה שנייה",
            errorChecker: (v) => onlySpecificAllowed(v, ["A", "B", "C"]),
            tutorial: "קל, בינוני, חמור. החומרה לא תשתנה לאחר פעילות מתקנת!",
          },
          {
            name: "assessment-2",
            label: "הערכת סיכון שנייה",
            errorChecker: (v) =>
              onlySpecificAllowed(
                v,
                ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
                "הערכת הסיכון חייבת להיות בין 0-10!",
              ),
            tutorial: "מחושב לפי הסבירות והחומרה על פי הטבלה",
          },
          {
            name: "responsible",
            label: "אחראי/ת לביצוע",
            tutorial: "נרצה להיות ספציפיים!",
          },
        ],
      },
      { name: "approval-notes", label: "דגשי מאשר האימון", isTypst: true },
      {
        name: "contact-list",
        label: "דרכ״ש",
        variadic: true,
        children: [
          { name: "personal-number", label: "מספר אישי" },
          { name: "name", label: "שם פרטי" },
          { name: "family-name", label: "שם משפחה" },
          { name: "phone", label: "טלפון" },
        ],
      },
    ],
  },
  "form-870": {
    name: "חוו״ד 870",
    group: "צה״לי",
    color: "#287233",
    parameters: [
      { name: "date", label: "תאריך" },
      { name: "force", label: "חיל" },
      { name: "unit", label: "יחידה" },
      { name: "course", label: "קורס", placeholder: "נחשון" },
      { name: "author-first-name", label: "שם פרטי של כותב החוו״ד" },
      { name: "author-phone-number", label: "מספר טלפון של כותב החוו״ד" },
      { name: "cadet-first-name", label: "שם פרטי של החייל/ת" },
      { name: "cadet-number", label: "מספר אישי של החייל/ת" },
      { name: "months-under-command", label: "חודשים תחת פיקודך" },
      {
        name: "familiarity",
        label: "מידת היכרות",
        tutorial: "קלושה/בינונית/די טובה/טובה מאוד",
      },
      {
        name: "current-job-title",
        label: "תפקיד נוכחי של החייל (ברמת בלמ״ס בלבד)",
      },
      {
        name: "strength",
        label: "חוזקות",
        variadic: true,
        children: [
          { name: "property", label: "תכונה" },
          { name: "descriptionOrExample", label: "פירוט או דוגמה" },
        ],
      },
      {
        name: "weakness",
        label: "חולשות",
        variadic: true,
        children: [
          { name: "property", label: "תכונה" },
          { name: "descriptionOrExample", label: "פירוט או דוגמה" },
        ],
      },
      {
        name: "ratings-1",
        label: "דירוג מאפיין: עצמאות בביצוע משימות",
        tutorial: (
          <>
            <p>
              לא ניתן להעריך/לא רלוונטי/נמוך מאוד/נמוך/בינוני/גבוה/גבוה מאוד
            </p>
            <p>
              ניתן לבחור עד שלושה מאפיינים בקטגוריה ״גבוה מאוד״ ועד שלושה
              מאפיינים בקטגוריה ״גבוה״.
            </p>
          </>
        ),
      },
      {
        name: "ratings-2",
        label: "דירוג מאפיין: תפקוד יעיל בלחץ ועומס",
        tutorial: (
          <>
            <p>
              לא ניתן להעריך/לא רלוונטי/נמוך מאוד/נמוך/בינוני/גבוה/גבוה מאוד
            </p>
            <p>
              ניתן לבחור עד שלושה מאפיינים בקטגוריה ״גבוה מאוד״ ועד שלושה
              מאפיינים בקטגוריה ״גבוה״.
            </p>
          </>
        ),
      },
      {
        name: "ratings-3",
        label: "דירוג מאפיין: קבלת החלטות",
        tutorial: (
          <>
            <p>
              לא ניתן להעריך/לא רלוונטי/נמוך מאוד/נמוך/בינוני/גבוה/גבוה מאוד
            </p>
            <p>
              ניתן לבחור עד שלושה מאפיינים בקטגוריה ״גבוה מאוד״ ועד שלושה
              מאפיינים בקטגוריה ״גבוה״.
            </p>
          </>
        ),
      },
      {
        name: "ratings-4",
        label: "דירוג מאפיין: משמעת והסתגלות לצרכי המערכת",
        tutorial: (
          <>
            <p>
              לא ניתן להעריך/לא רלוונטי/נמוך מאוד/נמוך/בינוני/גבוה/גבוה מאוד
            </p>
            <p>
              ניתן לבחור עד שלושה מאפיינים בקטגוריה ״גבוה מאוד״ ועד שלושה
              מאפיינים בקטגוריה ״גבוה״.
            </p>
          </>
        ),
      },
      {
        name: "ratings-5",
        label: "דירוג מאפיין: יכולת חשיבה ולמידה עצמית",
        tutorial: (
          <>
            <p>
              לא ניתן להעריך/לא רלוונטי/נמוך מאוד/נמוך/בינוני/גבוה/גבוה מאוד
            </p>
            <p>
              ניתן לבחור עד שלושה מאפיינים בקטגוריה ״גבוה מאוד״ ועד שלושה
              מאפיינים בקטגוריה ״גבוה״.
            </p>
          </>
        ),
      },
      {
        name: "ratings-6",
        label: "דירוג מאפיין: עבודת צוות",
        tutorial: (
          <>
            <p>
              לא ניתן להעריך/לא רלוונטי/נמוך מאוד/נמוך/בינוני/גבוה/גבוה מאוד
            </p>
            <p>
              ניתן לבחור עד שלושה מאפיינים בקטגוריה ״גבוה מאוד״ ועד שלושה
              מאפיינים בקטגוריה ״גבוה״.
            </p>
          </>
        ),
      },
      {
        name: "ratings-7",
        label: "דירוג מאפיין: אומץ, איתנות וקור רוח (רק לקרביים)",
        tutorial: (
          <>
            <p>
              לא ניתן להעריך/לא רלוונטי/נמוך מאוד/נמוך/בינוני/גבוה/גבוה מאוד
            </p>
            <p>
              ניתן לבחור עד שלושה מאפיינים בקטגוריה ״גבוה מאוד״ ועד שלושה
              מאפיינים בקטגוריה ״גבוה״.
            </p>
          </>
        ),
      },
      {
        name: "ratings-8",
        label: "דירוג מאפיין: אסרטיביות ויכולת הובלה",
        tutorial: (
          <>
            <p>
              לא ניתן להעריך/לא רלוונטי/נמוך מאוד/נמוך/בינוני/גבוה/גבוה מאוד
            </p>
            <p>
              ניתן לבחור עד שלושה מאפיינים בקטגוריה ״גבוה מאוד״ ועד שלושה
              מאפיינים בקטגוריה ״גבוה״.
            </p>
          </>
        ),
      },
      {
        name: "ratings-9",
        label: "דירוג מאפיין: אחריות והשקעה במשימה",
        tutorial: (
          <>
            <p>
              לא ניתן להעריך/לא רלוונטי/נמוך מאוד/נמוך/בינוני/גבוה/גבוה מאוד
            </p>
            <p>
              ניתן לבחור עד שלושה מאפיינים בקטגוריה ״גבוה מאוד״ ועד שלושה
              מאפיינים בקטגוריה ״גבוה״.
            </p>
          </>
        ),
      },
      {
        name: "ratings-10",
        label: "דירוג מאפיין: קבלת ביקורת",
        tutorial: (
          <>
            <p>
              לא ניתן להעריך/לא רלוונטי/נמוך מאוד/נמוך/בינוני/גבוה/גבוה מאוד
            </p>
            <p>
              ניתן לבחור עד שלושה מאפיינים בקטגוריה ״גבוה מאוד״ ועד שלושה
              מאפיינים בקטגוריה ״גבוה״.
            </p>
          </>
        ),
      },
      {
        name: "motivation-for-course",
        label: "מה מידת המוטיבציה של החייל/ת לצאת קצונה?",
      },
      {
        name: "difficulty-areas",
        label: " באילו תחומים עלול/ה החייל/ת להתקשות בקורס קצינים/בתפקיד?",
      },
      {
        name: "relative-quality",
        label: " באיזו מידה מתאים/ה המועמד/ת לקצונה ביחס לחיילים האחרים?",
        tutorial:
          "יותר מרוב החיילים בתפקידים דומים/כמו רוב החיילים בתפקידים דומים/פחות מרוב החיילים בתפקידים דומים/אינו/ה מתאים/ה כלל לקצונה",
      },
      {
        name: "accept-as-your-worker",
        label: " באיזו מידה תהיה/י מוכן/ה לקבל את החייל/ת כקצין/ה תחת פיקודך?",
        tutorial:
          "במידה רבה מאוד/במידה רבה/במידה בינונית/במידה מועטה/איני מעוניין/ת כלל",
      },
      { name: "higher-authority-first-name", label: "שם פרטי של המפקד הישיר" },
      { name: "higher-authority-phone-number", label: "טלפון של המפקד הישיר" },
      {
        name: "higher-authority-familiarity-months",
        label: "משר היכרות של המפקד הישיר עם החייל בחודשים",
      },
      {
        name: "higher-authority-familiarity",
        label: "מידת היכרות של המפקד הישיר",
        tutorial: "טובה מאוד/די טובה/בינונית/קלושה/איני יכול/ה להעריך",
      },
      {
        name: "higher-authority-fitness-assessment",
        label:
          "מפקד ישיר -  תאר/י את מידת ההתאמה של החייל/ת לקצונה, תוך התייחסות לנקודות חוזק וחולשה שלו/ה.",
      },
      {
        name: "higher-authority-accept-as-your-worker",
        label:
          "מפקד ישיר - באיזו מידה תהיה/י מוכן/ה לקבל את המועמד/ת כקצין/ה תחת פיקודך (ללא קשר לאילוצי כ״א)?",
      },
      {
        name: "higher-authority-notes",
        label: "מפקד ישיר - הערות נוספות",
      },
    ],
  },
  "independence-day-award-recommendation": {
    name: "המלצה על חייל למצטיין יום העצמאות",
    group: "צה״לי",
    color: "#0E294B",
    parameters: [
      {
        name: "commander-name",
        label: "שם המפקד/ת",
        tutorial:
          "הנך מתבקש לתאר בפירוט ובהרחבה את הסיבות להצטיינותו של החייל בתחומים המפורטים. הבא דוגמאות לחיזוק דבריך בכל סעיף. עליך לכלול נימוקים המסבירים מדוע לדעתך חייל זה הינו יוצא דופן וראוי לפרס יותר ממועמדים אחרים שהוגשו.",
      },
      { name: "commander-job", label: "תפקיד המפקד/ת" },
      { name: "soldier-name", label: "שם החייל/ת" },
      { name: "soldier-job", label: "תפקיד החייל/ת" },
      { name: "familiarity-time", label: "זמן ההיכרות המקצועית" },
      {
        name: "is-outstanding",
        label: "האם החייל/ת בולט באיכות ומקצועיות עבודתו? נמק/י.",
        isTypst: true,
      },
      {
        name: "is-central-figure",
        label:
          "האם החייל/ת מהווה גורם מרכזי ביחידה (דוגמה אישית, דמות סמכות וכדומה)? פרט/י ונמק/י.",
        isTypst: true,
      },
      {
        name: "is-team-player",
        label:
          "האם המועמד/ת תורמ/ת ומעודד/ת עבודת צוות (אוירה טובה, נעזרים בעמיתיהם וכדומה)? פרט/י ונמק/י.",
        isTypst: true,
      },
      {
        name: "did-initiate",
        label:
          "האם יזמ/ה שינוי משמעותי ו/או קידום משמעותי בתהליכי עבודה, אילו תוצאות הניבו יוזמות אלו?",
        isTypst: true,
      },
      {
        name: "did-mentor",
        label:
          "האם חנכ/ה חייל/ת חדש/ה ו/או חנכ/ה חייל/ת חניכה מקצועית? אנא פרט/י.",
        isTypst: true,
      },
      {
        name: "is-leader",
        label:
          "במידה ולמועמד/ת יש לפחות כפיפ/ה אחד/אחת - האם החייל נתפס כממונה המגלה כושר הובלה ומנהיגות, מעודד ודוחף את חייליו למצוינות ומעודד חדשנות וכדומה? פרט/י ונמק/י.",
        isTypst: true,
      },
      {
        name: "extra",
        label:
          "במידה ויש מידע חשוב נוסף אשר בגינו הינך חושב/ת שהמועמד/ת ראוי/ה להיבחר כחייל/ת מצטיינ/ת, ולא ניתן לו המקום, עד כה, אנא פרט/י ונמק/י.",
        isTypst: true,
      },
      {
        name: "outstanding-attribute",
        label:
          "מהו המאפיין העיקרי בגינו הינך חושב שהעובד/ת בולט/ת מעל כל החיילים, אשר מזכה אותם להיות חיילים מצטיינים?",
        isTypst: true,
      },
    ],
  },
  "form-d1": {
    name: "נספח ד׳ 1",
    group: "צה״לי",
    color: "#6C4675",
    parameters: [
      { name: "unit-details", label: "פרטי היחידה הצבאית" },
      { name: "event-details", label: "פרטי סוג הפעילות" },
      { name: "event-location", label: "מיקום ומסלול הפעילות" },
      { name: "event-participants", label: "משתתפי הטיול וסה״כ סד״כ מתוכנן" },
      {
        name: "event-schedule",
        label: "לו״ז הפעילות",
        isTypst: true,
        tutorial: "לו״ז מפורט, כולל הפסקות אוכל ושתייה ושעות שינה",
      },
      { name: "event-date", label: "מועד ושעות הפעילות" },
      { name: "food-and-drink", label: "מענה מזון ושתייה" },
      {
        name: "event-instructor",
        label: "מענה ההדרכה",
        tutorial: "פנים יחידתי/יחידת חיל חינוך/רכש מוקד חינוך",
      },
      { name: "dress-code", label: "אופן הלבוש ודגשים אחרים" },
      { name: "gift-distribution", label: "חלוקת תשורה" },
      {
        name: "safety-officer",
        label: "קצינ/ת הבטיחות",
        tutorial: "ימונו בנוסף למפקד הפעילות כשצפויים להשתתף מעל 30 משתתפים",
      },
      {
        name: "medical-response",
        label: "מענה רפואי",
        tutorial: "נספח פרטי החובש, דרכי הפינוי הרפואי ותחנות מד״א במרחב",
      },
      {
        name: "weather-forecast",
        label: "תחזית מטאורולוגית צפויה ליום הפעילות",
        tutorial: "יש לוודא 24 שעות מראש",
      },
      {
        name: "weather-notes",
        label: "דגשים הנוגעים למזג האוויר",
        isTypst: true,
      },
      {
        name: "physical-effort",
        label: "דגשים הנוגעים למאמץ פיזי",
        isTypst: true,
        tutorial: "צירוף הנחיות נציג הרפואה היחידתי",
      },
      {
        name: "security-notes",
        label: "דגשים הנוגעים לאבטחה",
        isTypst: true,
        tutorial: "נספח האבטחה הנדרשת, פרטי סד״כ האבטחה ונשקו",
      },
      {
        name: "transportation",
        label: "מענה ההיסעים ודרכי הגעה",
        isTypst: true,
      },
      {
        name: "safety-issues",
        label: "ניתוח נקודות התורפה הבטיחותיות (נת״בים) נוספות בפעילות",
        variadic: true,
        children: [
          { name: "stage", label: "שלב בפעילות" },
          { name: "description", label: "תיאור הנת״ב" },
          { name: "preventive-action", label: "פעילות מניעה ובקרה" },
          { name: "notes", label: "הערות" },
        ],
      },
      {
        name: "safety-book",
        label: "במקרה של סיור במכון/באתר מורשת/נופש במתקני ״יחד למען החייל״",
        tutorial: "תיק הבטיחות מטעם הגוף המארח",
      },
    ],
  },
  "special-population-meeting-summary": {
    name: "סיכום ראיון לאוכלוסייה מיוחדת",
    group: "צה״לי",
    color: "#7FB5B5",
    parameters: [
      { name: "personal-number", label: "מספר אישי" },
      { name: "soldier-name", label: "שם החייל/ת" },
      { name: "marital-status", label: "מצב משפחתי" },
      { name: "date-of-enlistment", label: "תאריך גיוס" },
      { name: "address", label: "כתובת מגורים" },
      { name: "job-title", label: "תפקיד החייל/ת ביחידה" },
      { name: "special-population-type", label: "סוג אוכלוסיה מיוחדת" },
      { name: "family-background", label: "רקע משפחתי" },
      {
        name: "aliyah",
        label:
          "באם החייל/ת עולה חדש/ה - האם עלו ארצה בגופם, ארץ עלייה, מועד עלייה, באילו קשיים נתקלו בארץ ובמהלך שירותם הצבאי",
      },
      { name: "address-details", label: "מקום מגורי החייל" },
      {
        name: "family-support",
        label:
          "באם החייל/ת מתגורר עם משפחתו - האם קיים גורם אשר זקוק לתמיכת החייל/ת? אם כן, פרט/י",
      },
      {
        name: "needs-housing",
        label:
          "באם החייל/ת מתגורר עם משפחתו - האם זקוק/ה לפתרון דיור צה״לי? מדוע?",
      },
      {
        name: "is-satisfied-housing",
        label:
          "באם החייל/ת מתגורר/ת בפתרון דיור צה״לי - האם הם שבעי רצון מפתרון זה? האם הם מעוניינים בפתרון דיור חלופי?",
        isTypst: true,
      },
      {
        name: "financial-difficulties",
        label:
          "האם החיל/ת נתקל בקשיים כלכליים מיוחדים? אם כן, כיצד הם באים לידי ביטוי?",
      },
      {
        name: "work-permit",
        label:
          "האם לחייל/ת היתר עבודה? אם כן, האם הם מממשים אותו? אם לא, מדוע?",
      },
      {
        name: "financial-support",
        label:
          "האם החייל/ת מימש/ה אחד מערוצי הסיוע הבאים: חופשה מיוחדת כלכלית/מענק/הלוואה/מענקי מזון/קרן סיוע? אם לא, האם מעוניינ/ת באחד מערוצים אלו? פרט/י",
      },
      {
        name: "social-adjustment",
        label:
          "הסתגלות חברתית של החייל/ת ביחידה (מצב חברתי, האם החייל/ת מרוצה בשיבוצם)",
      },
      {
        name: "tash-satisfaction",
        label: "הטבות ת״ש - האם החייל/ת שבעי רצון מטיפול הת״ש ביחידה?",
      },
      { name: "issues", label: "בעיות אשר החייל/ת העלו ונושאים לטיפול" },
      { name: "evacuation-time", label: "כמה זמן משפחת החייל/ת מפונה מביתם?" },
      {
        name: "evacuation-benefits",
        label:
          "האם הורי החייל/ת עזבו את מקום עבודתם? האם הם מודעים שעשויים להיות זכאים למענק חזרה לעבודה",
      },
      {
        name: "parents-job",
        label: "האם משפחת החייל/ת מקבלת את ההטבות שזכאית אליהן מטעם המדינה?",
      },
      {
        name: "evacuation-registered",
        label: "האם משפחת החייל/ת נרשמו כמפונים דרך הביטוח הלאומי?",
      },
      {
        name: "difficult-issues",
        label: "אוכלוסיית מפונים - האם קיימות בעיות חריגות?",
      },
      {
        name: "evacuation-job-issues",
        label: "העם בעקבות הפינוי קיימת מורכבות עם שיבוץ החייל/ת?",
      },
      { name: "submission-date", label: "תאריך העברת הפורמט לידי מש״קית הת״ש" },
    ],
  },
  "trip-plan": {
    name: "תוכנית סיור",
    group: "בה״די",
    color: "#FAD201",
    parameters: [
      { name: "map-width", label: "רוחב מפה בפיקסלים" },
      { name: "map-height", label: "אורך מפה בפיקסלים" },
      { name: "map-center", label: "נ״צ מרכז המפה" },
      { name: "map-zoom", label: "זום למפה" },
      {
        name: "sections",
        label: "מקטע",
        variadic: true,
        children: [
          { name: "description", label: "תיאור", isTypst: true },
          { name: "color", label: "צבע" },
          {
            name: "points",
            label: "נקודה",
            variadic: true,
            children: [
              { name: "name", label: "שם" },
              { name: "coordinates", label: "נ״צ" },
              { name: "description", label: "תיאור", isTypst: true },
            ],
          },
        ],
      },
    ],
    postprocess: async (parameters) => {
      const getLatLong = (s?: string) => {
        return s?.split(",").map((x) => parseFloat(x.trim()))
      }

      let width = parameters["map-width"]
      let height = parameters["map-height"]
      let center = parameters["map-center"]
      let zoom = parameters["map-zoom"]
      let points = parameters["sections"]
        .flatMap((section: any) =>
          section.points.map((point: any) => ({
            color: section.color,
            coordinates: point.coordinates,
          })),
        )
        .filter((x: any) => x !== undefined)
      if (!width || !height || !center || !zoom || !points) {
        return
      }
      width = parseInt(width, 10)
      height = parseInt(height, 10)
      center = getLatLong(center)
      zoom = parseInt(zoom, 10)
      points = points
        .filter((x: any) => getLatLong(x.coordinates) !== undefined)
        .map((x: any) => ({
          color: x.color,
          latitude: getLatLong(x.coordinates)![0],
          longitude: getLatLong(x.coordinates)![1],
        }))

      let mapImage = await renderMap(width, height, center, zoom, points)
      mapImage = mapImage.split(",")[1]
      window.typstCompiler!.mapShadow(
        "/assets/map.png",
        Uint8Array.from(atob(mapImage), (c) => c.charCodeAt(0)),
      )

      parameters["map-image"] = "assets/map.png"
    },
    buttons: [
      {
        label: "הורדת KML",
        icon: "map",
        onClick: async (parameters) => {
          const hexToKML = (color?: string) => {
            if (!color) {
              return ""
            }

            return (
              "ff" + color.slice(5, 7) + color.slice(3, 5) + color.slice(1, 3)
            )
          }

          downloadText(
            "application/vnd.google-earth.kml+xml",
            `
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    ${parameters.sections
      .map((section: any, sectionIndex: number) =>
        `
    <Style id="style-${sectionIndex}">
      <IconStyle>
        <color>${hexToKML(section.color)}</color>
        <Icon>
          <href>https://www.gstatic.com/mapspro/images/stock/503-wht-blank_maps.png</href>
        </Icon>
      </IconStyle>
    </Style>
    <Folder>
      <name>מקטע ${sectionIndex + 1}</name>
      ${section.points
        .map(
          (point: any) => `
        <Placemark>
          <name>${point.name}</name>
          <styleUrl>#style-${sectionIndex}</styleUrl>
          <Point>
            <coordinates>${point.coordinates
              .split(",")
              .map((x: string) => x.trim())
              .reverse()
              .join(",")}</coordinates>
          </Point>
        </Placemark>
      `,
        )
        .join("\n")}
    </Folder>
      `.trim(),
      )
      .join("\n")}
  </Document>
</kml>
`.trim(),
            "trip.kml",
          )
        },
      },
    ],
  },
}

const LIBRARY_CODE = `
#let not-idf-document = (
  letter-in-memory: true,
  form-870: true,
)
#let sex-state = state("sex")
#let author-state = state("author")
#let post-signature-state = state("post-signature")
#let s(male-text, female-text) = (
  context if sex-state.final() == "זכר" {
    male-text
  } else {
    female-text
  }
)

#let idf-document(
  title: "",
  date: none,
  lang: "he",
  secretness: "בלמ״ס",
  to: (),
  da: (),
  author: "",
  job-title: "",
  rank: "",
  sender-details: "",
  logos: (),
  number: "",
  hebdate: ("", ""),
  engdate: ("", ""),
  sex: "זכר",
  signature: "",
  signature-width: 6,
  use-david-clm: false,
  compact: false,
  for-civillians: false,
  slogan: "",
  body,
) = {
  set document(author: author, title: title, date: date)
  sex-state.update(sex)
  author-state.update(author)

  set page(
    header: [
      #set align(center)
      #set par(spacing: 0.5em, leading: 0.5em)
      #underline[*#secretness*]

      #context here().page()
    ],
    footer: [
      #set align(center)
      #set par(spacing: 0.5em, leading: 0.5em)
      #if secretness == "סודי" or secretness == "סודי ביותר" [
        #underline[*#secretness*]
      ]

      #if slogan != "" [
        #emph[#slogan]
      ]
    ],
    margin: 2.5cm,
  )
  set text(font: if use-david-clm { "David CLM" } else { ("David", "David Libre", "David CLM") }, lang: lang, size: 12pt)
  set heading(numbering: "1.a.")
  set par(leading: if compact { 1em } else { 1.5em })
  set par(spacing: if compact { 1.5em } else { 2em })
  set enum(
    numbering: (..n) => {
      let a = n.pos()
      let number = a.at(a.len() - 1)
      let level = a.len()

      if level == 1 [#number.]
      if level == 2 [#numbering("א", number).replace("׳", "").]
      if level == 3 [#number)]
      if level == 4 [#numbering("א", number).replace("׳", ""))]
      if level == 5 [(#number)]
      if level == 6 [(#numbering("א", number).replace("׳", ""))]
    },
    full: true,
  )
  set table(
    // align: center + horizon,
    fill: (x, y) => {
      if x == 0 or y == 0 {
        return luma(80%)
      }
    }
  )
  show table.cell.where(x: 0): set text(weight: "bold")
  show table.cell.where(y: 0): set text(weight: "bold")
  show table.cell: it => {
    if it.body.func() == enum {
      set par(justify: true)
      set align(right)

      it
    } else {
      set par(justify: false)
      set align(center + horizon)

      it
    }
  }

  show link: it => {
    underline(it)
  }
  show regex("אחריות.*תג.?ב.*"): it => {
    h(1fr)  
    box[
      #h(1fr)
      #it
    ]
  }
  show regex("אחראי.*תג.?ב.*"): it => {
    h(1fr)  
    box[
      #h(1fr)
      #it
    ]
  }

  grid(
    columns: (1fr, 6cm),
    [
      #let logos-after-empty = if logos.len() == 0 { ("assets/logo.png",) } else { logos }
      #let logos-after-civillians = if for-civillians { ("assets/idf-logo.png", ..logos-after-empty) } else { logos-after-empty }
      #for logo in logos-after-civillians [
        #box(height: 1.8cm, width: 1.8cm, image(logo))
      ]
    ],
    [
      #set align(end)

      #rect(stroke: none)[
        #if sender-details == "" [
          #set par(spacing: 0.5em, leading: 0.5em)
          #box(width: 6cm)[
            *בית הספר לקצינים*
            #linebreak(justify: true)
            *ע״ש רא״ל לסקוב*
            #linebreak(justify: true)
            *ענף ההדרכה*
            #linebreak(justify: true)
            #v(0.25em)
            טלפון מטכ״לי: 03-9876443
            #linebreak(justify: true)
            טלפון אזרחי: 03-1928376
            #linebreak(justify: true)
            מספר פקס: 03-1928376
            #linebreak(justify: true)
          ]
        ] else [
          #set par(spacing: 0.5em, leading: 0.5em)
          #let sender-details-phone-index = sender-details.position("טלפון")
          #box(width: 6cm)[
            #for l in sender-details.slice(0, sender-details-phone-index).split("\\n") [
              #set text(weight: "bold")
              #l
              #linebreak(justify: true)
            ]
            #if sender-details-phone-index != none [
              #for l in sender-details.slice(sender-details-phone-index).split("\\n") [
                #l
                #linebreak(justify: true)
              ]
            ]
          ]
        ]

        #box(width: 6cm)[
          #v(-0.5em)
          #set par(spacing: 0.5em, leading: 0.5em)
          #if hebdate.len() > 0 [
            #hebdate.join(" ")
            #linebreak(justify: true)
          ]

          #if engdate.len() > 0 [
            #engdate.join(" ")
            #linebreak(justify: true)
          ]
        ]
      ]
    ],
  )

  v(-1.5em)
  if type(to) == str and to != "" { underline[אל: #to] } else [
    #set par(leading: 1em)
    #set par(spacing: 1em)

    #for t in to [
      #underline[אל: #t]

      
    ]
  ]
  
  if type(da) == str and da != "" [
    #set par(leading: 1em)
    #set par(spacing: 1em)

    דע: #da
  ] else {
    for d in da [
      #set par(leading: 1em)
      #set par(spacing: 1em)

      #if d != "" [
        דע: #d
      ]
    ]
  }

  if not compact {
    v(-0.5em)
  }

  if title != "" [
    #h(5pt) שלום רב,

    #align(center)[
      הנדון: *#underline[#title]*
    ]
  ]

  set par(justify: true)

  body

  if author != "" {
    grid(
      columns: (1fr, 6cm),
      [],
      [
        #set par(leading: 1.25em, spacing: 1.25em)
        בברכה,

        #v(-10pt)
        #if signature != "" [#box(width: 100%)[
            #set align(center)

            #box(width: signature-width * 1cm, image(signature))
          ]]

        #if rank == "" [
          #if sex == "זכר" [
            צוער
          ] else [
            צוערת
          ]
        ] else [
          #rank
        ]
        #for x in author.split(" ") [
          #h(1fr)
          #x
        ]

        #v(-10pt)
        #if job-title == "" [
          #if sex == "זכר" [
            צוער #h(1fr) בבית #h(1fr) הספר #h(1fr) לקצינים
          ] else [
            צוערת #h(1fr) בבית #h(1fr) הספר #h(1fr) לקצינים
          ]
        ] else [
          #job-title
          #linebreak(justify: true)
        ]
      ],
    )
  }

  context post-signature-state.final()
}

#let work(content: "") = {
  eval(content, mode: "markup")
}

#let debrief(
  event-moed: "",
  event-location: "",
  event-description: "",
  event-results: "",
  event-participants: "",
  background: "",
  chronological-order: "",
  additional-background: "",
  causes: "",
  mistakes: "",
  notable-mentions: "",
  learned: "",
  suggestions: "",
  ..ignored,
) = [
  + *כללי*

    #rect(width: 100%, inset: 10pt)[
      *מועד האירוע:* #event-moed

      *מקום האירוע:* #event-location

      *תיאור האירוע:* #event-description

      *תוצאות האירוע:* #event-results

      *משתתפים בתחקיר:*
      
      #eval(event-participants, mode: "markup")
    ]

  + *ממצאים*

    + *ממצאי רקע*

      #eval(background, mode: "markup")
    + *רצף כרונולוגי*

      #eval(chronological-order, mode: "markup")
    + *ממצאים נוספים*

      #eval(additional-background, mode: "markup")
  + *מסקנות*

    + *גורמים*

      #eval(causes, mode: "markup")
    + *תקלות ושגיאות*

      #eval(mistakes, mode: "markup")
    + *נק׳ ראויות לציון*

      #eval(notable-mentions, mode: "markup")
  + *לקחים*

      #eval(learned, mode: "markup")
  + *המלצות*

      #eval(suggestions, mode: "markup")
]

#let plan-approval(
  main-mission: "",
  responsibility: "",
  success: "",
  why: "",
  challenges: "",
  strengths-and-weaknesses: "",
  team-state: "",
  my-context: "",
  relevant-context: "",
  target-1: "",
  target-2: "",
  target-3: "",
  how-1: "",
  how-2: "",
  how-3: "",
  how-4: "",
  how-5: "",
  how-6: "",
  goal-1: "",
  goal-2: "",
  goal-3: "",
  goal-4: "",
  goal-5: "",
  goal-6: "",
  challenge-1: "",
  challenge-2: "",
  challenge-3: "",
  challenge-4: "",
  challenge-5: "",
  challenge-6: "",
  ..ignored,
) = [
  + *משימה*
    + *מה היא משימתך העיקרית בהתנסות ואיך את/ה תופס/ת אותה?*

      #main-mission
    + *מה נמצא תחת אחריותך לאור הגדרת התפקיד בהתנסות ומרכיביו?*

      #responsibility
    + *מה תגדיר/י כהצלחה במשימה?*

      #success
  + *מנהיג/ה*
    + *למה את/ה חושב/ת שקיבלת את ההתנסות?*

      #why
    + *על אילו יעדים מיעדיך האישיים היית רוצה לשים דגש כחלק מעמידה במשימה? (הוסף לטבלה המצורפת)*

      *כיצד תחזק/י אותם במהלך ההתנסות?*

      *יש להתייחס ליעד אחד מיעדיך האישיים אשר הצבת בתחילת ההכשרה + 2 יעדים מקצועיים התואמים את אופי ההתנסות.*

      #table(
        columns: (1fr, 1fr, 1fr, 1fr),
        [*מטרה*], [*יעדים*], [*אתגרים שאני צופה בעמידה ביעד*], [*איך אדע אם היעד מקדם אותי למטרה?*],
        table.cell(rowspan: 2)[1. #target-1], [#goal-1], [#challenge-1], [#how-1], [#goal-2], [#challenge-2], [#how-2],
        table.cell(rowspan: 2)[2. #target-2], [#goal-3], [#challenge-3], [#how-3], [#goal-4], [#challenge-4], [#how-4],
        table.cell(rowspan: 2)[3. #target-3], [#goal-5], [#challenge-5], [#how-5], [#goal-6], [#challenge-6], [#how-6],
      )
    + *מה יהיו נקודות האתגר שלך במשימה?*

      #challenges
    + *כיצד החוזקות שלך יבואו לידי ביטוי בביצוע המשימה? כיצד הן מסייעות לך להתגבר על נקודות האתגר שלך?*

      #strengths-and-weaknesses
  + *מונהגים*
    + *מה מצב הצוות בנקודת זמן זו? מה הצוות צריך כדי לצלוח את המשימה?*

      התייחס/י לנקודות האתגר והחוזקה של *הצוות*

      #team-state
  + *הקשר*
    + *באילו תנאים תקיים/י את ההתנסות? (לדוגמה, מצב הצוות/פלוגה, נושא השבוע, תורנויות)*

      #my-context
    + *מה בסביבה עלול לסייע לך ומה עשוי לעכב אותך בהצלחתך? (התייחס/י לכל גורם משפיע)*

      #relevant-context
]

#let plan-approval-instructional(
  main-mission: "",
  responsibility: "",
  success: "",
  why: "",
  challenges: "",
  strengths-and-weaknesses: "",
  team-state: "",
  my-context: "",
  relevant-context: "",
  target-1: "",
  target-2: "",
  target-3: "",
  how-1: "",
  how-2: "",
  how-3: "",
  how-4: "",
  how-5: "",
  how-6: "",
  goal-1: "",
  goal-2: "",
  goal-3: "",
  goal-4: "",
  goal-5: "",
  goal-6: "",
  challenge-1: "",
  challenge-2: "",
  challenge-3: "",
  challenge-4: "",
  challenge-5: "",
  challenge-6: "",
  content-opening: "",
  time-opening: "",
  elements-opening: "",
  content-body: "",
  time-body: "",
  elements-body: "",
  content-end: "",
  time-end: "",
  elements-end: "",
  general-question: "",
  advancing-questions: "",
  arguments-for: "",
  arguments-against: "",
  ..ignored,
) = [
  #plan-approval(
    main-mission: main-mission,
    responsibility: responsibility,
    success: success,
    why: why,
    challenges: challenges,
    strengths-and-weaknesses: strengths-and-weaknesses,
    team-state: team-state,
    my-context: my-context,
    relevant-context: relevant-context,
    target-1: target-1,
    target-2: target-2,
    target-3: target-3,
    how-1: how-1,
    how-2: how-2,
    how-3: how-3,
    how-4: how-4,
    how-5: how-5,
    how-6: how-6,
    goal-1: goal-1,
    goal-2: goal-2,
    goal-3: goal-3,
    goal-4: goal-4,
    goal-5: goal-5,
    goal-6: goal-6,
    challenge-1: challenge-1,
    challenge-2: challenge-2,
    challenge-3: challenge-3,
    challenge-4: challenge-4,
    challenge-5: challenge-5,
    challenge-6: challenge-6,
  )

  #pagebreak()

  #enum(
    enum.item(5)[
      אם ההתנסות היא הדרכתית יש למלא את הפורמט הבא - אופן התנהלות השיעור/התנסות

      #table(
        columns: (1fr, 3fr, 1fr, 2fr),
        [*השלב בשיעור*], [*התוכן המועבר*], [*הזמן המוקצה*], [*עזרי ההדרכה*],
        [פתיחה], [#content-opening], [#time-opening], [#elements-opening],
        [גוף], [#content-body], [#time-body], [#elements-body],
        [סיכום], [#content-end], [#time-end], [#elements-end],
      )

      *עץ דיון*

      *שאלה כללית:*

      #general-question

      *שאלות מקדמות:*

      #advancing-questions

      *טיעונים בעד:*

      #arguments-for

      *טיעונים נגד:*

      #arguments-against
    ],
  )
]

#let post-experience-debrief(
  experience-summary: "",
  details: "",
  future: "",
  tips: "",
  summary: "",
  ..ignored,
) = [
  + *סכם/י במילים שלך כיצד חווית את ההתנסות?*

    #experience-summary
  + *פירוט:*

    #details
  + *פרט/י מה תיקח/י הלאה לתפקידך העתידי כקצין/ה מתוך התנהלותך במהלך ההתנסות.*

    #future

  + *דגשים למתנסים הבאים (מינימום 3 טיפים לבא/ה אחריך).*

    #tips
  + *סיכום*

    #summary
]

#let organization-order(
  general: "",
  goals: "",
  method: "",
  rationale: "",
  schedule: (),
  responsibilities: (),
  highlights: "",
  ..ignored,
) = [
  + *כללי*

    #eval(general, mode: "markup")
  + *מטרות*

    #eval(goals, mode: "markup")
  + *שיטה*

    #eval(method, mode: "markup")
  + *רציונאל*

    #eval(rationale, mode: "markup")
  + *לו"ז עקרוני*
    #table(
      columns: (1fr, 1fr, 1fr, 1fr),
      [שעות], [תוכן], [גורם מעביר], [הערות],
      ..schedule.map((s) => (
        s.at("hours", default: ""),
        eval(s.at("content", default: ""), mode: "markup"),
        s.at("responsible", default: ""),
        eval(s.at("notes", default: ""), mode: "markup"),
      )).flatten()
    )
  + *תחומי אחריות*

    #table(
      columns: (1fr, 1fr, 1fr),
      [גורם אחראי], [תוכן], [הערות],
      ..responsibilities.map((s) => (
        s.at("responsible", default: ""),
        eval(s.at("content", default: ""), mode: "markup"),
        eval(s.at("notes", default: ""), mode: "markup"),
      )).flatten()
    )
  + *דגשים*

    #eval(highlights, mode: "markup")
]

#let meeting-plan(
  meeting-date: "",
  meeting-title: "",
  meeting-target: "",
  meeting-duration: "",
  meeting-leader: "",
  meeting-location: "",
  meeting-invitees: "",
  meeting-schedule: "",
  meeting-responsibilities: "",
  meeting-highlights: "",
  ..ignored,
) = [
  + *כללי*
    + בתאריך #meeting-date יתקיים דיון בנושא #meeting-title.
    + מטרת הדיון: #meeting-target.
    + משך הדיון: #meeting-duration.
    + מוביל/ת הדיון: #meeting-leader.
    + מיקום: #meeting-location.
    + מוזמנים:
    
      #eval(meeting-invitees, mode: "markup")
  + *לוח זמנים*

    #table(
      columns: (1fr, 1fr, 1fr, 1fr),
      [נושא], [מוביל/ה], [משתתפים], [זמן],
      ..meeting-schedule.map((s) => (
        s.at("subject", default: ""),
        s.at("leader", default: ""),
        s.at("participants", default: ""),
        s.at("time", default: ""),
      )).flatten()
    )
  + *תחומי אחריות*

    #eval(meeting-responsibilities, mode: "markup")
  + *דגשים*

    #eval(meeting-highlights, mode: "markup")
]

#let meeting-summary(meeting-date: "", meeting-title: "", meeting-purpose: "", meeting-participants: "", meeting-summary-and-tasks: "") = [
  + *כללי*
    + בתאריך #meeting-date התקיים דיון בנושא #meeting-title.
    + מהות הדיון: #meeting-purpose.
    + המשתתפים בדיון:
      
      #eval(meeting-participants, mode: "markup")
  + *סיכום מפקד וחלוקת אחריות*
  
    #eval(meeting-summary-and-tasks, mode: "markup")
]

#let risk-management(event-details: "", risk: ()) = {
  if event-details != "" [
    *פרטי האירוע*
    
    #eval(event-details, mode: "markup")
  ]

  table(
    columns: (3fr, 3fr, 3fr, 3fr, 1fr, 1fr, 1fr, 3fr , 1fr, 1fr, 1fr, 3fr),
    [שלב במשימה], [סכנה], [סיכון], [גורם 5M], table.cell(colspan: 3)[הערכת סיכון ראשונה], [פעילות מתקנת], table.cell(colspan: 3)[הערכת סיכון שנייה], [אחראי לביצוע],
    ..risk.map((r) => (
      r.at("stage", default: ""),
      r.at("danger", default: ""),
      r.at("risk", default: ""),
      r.at("cause-5m", default: ""),
      r.at("probability-1", default: ""),
      r.at("danger-level-1", default: ""),
      r.at("assessment-1", default: ""),
      r.at("preventive-measures", default: ""),
      r.at("probability-2", default: ""),
      r.at("danger-level-2", default: ""),
      r.at("assessment-2", default: ""),
      r.at("responsible", default: "")
    )).flatten()
  )
}

#let simulation-processing(name: "", simulation-type: "", feeling: "", challenge: "", strength: "", satisfied: "", would-change: "", leader-perception: "", conclusions: "", tools: "") = [
  + *שם המסומלצ/ת:* #name
  + *סוג הסימולציה:* #simulation-type
  + *איך הרגשת במהלך ביצוע הסימולציה?*

    #feeling
  + *שתפ/י בנקודת אתגר שלך לאורך ביצוע הסימולציה.*

    #challenge
  + *שתפ/י בנקודת חוזק שלך לאורך ביצוע הסימולציה.*

    #strength
  + *האם את/ה מרוצה מהאופן בו פעלת?*

    #satisfied
  + *מה היית עושה באופן אחר?*

    #would-change
  + *האם תפיסתך הפיקודית באה לידי ביטוי? אם כן, באיזה אופן?*

    #leader-perception
  + *מהן המסקנות שלך מביצוע הסימולציה?*

    #conclusions
  + *אם מדובר בסימולציה בעיבוד צוותי - שתפ/י בכלים אשר קיבלת מהצוות במהלך עיבוד הסימולציה.*

    #tools
]

#let letter-in-memory(person-name: "", introduction-line: "", leading-values: "", person-quote: "", is-male: "כן", submitters: "", photo: "", rank: "") = [
  #set text(lang: "he", font: "David CLM", size: 18pt)
  #set par(justify: true, spacing: 1.4em)

  #table(stroke: none, columns: (1fr, auto), [
    #box(height: 50pt, image("assets/idf-logo.png"))
    #h(10pt)
    #box(height: 50pt, image("assets/logo.png"))

    #text(size: 20pt, spacing: 250%)[פרויקט ״מגש הכסף״ - #rank.trim() #person-name.trim() ז״ל]
  ], [
    #if photo != "" [
      #box(height: 150pt, image(photo))
    ]
  ])

  #eval(introduction-line, mode: "markup")
  
  #if is-male == "כן" [
    לאחר שהעמקתי בדמותו של #person-name.split(" ").at(0), הבחנתי בערכים המובילים שאקח איתי הלאה מדמותו:
  ] else [
    לאחר שהעמקתי בדמותה של #person-name.split(" ").at(0), הבחנתי בערכים המובילים שאקח איתי הלאה מדמותה:
  ]
    
  #eval(leading-values, mode: "markup")
  
  #if is-male == "כן" [
    בחרתי במשפט שמבטא את אישיותו של #person-name.split(" ").at(0), שמשקף את רוחו וערכיו:
  ] else [
    בחרתי במשפט שמבטא את אישיותה של #person-name.split(" ").at(0), שמשקף את רוחה וערכיה:
  ]

  #[
    #set text(size: 20pt, spacing: 250%)
    #set align(center)
    #eval(person-quote, mode: "markup")
  ]

  #v(1fr)

  #[
    #set text(size: 15.5pt)
    #submitters
  ]
]

#let cadet-tutors-cadet-feedback(phenomena: (), overview: "") = [
  #for phenomenon in phenomena [
    #text(size: 16pt)[*ציר ה#phenomenon.at("axis", default: ""): #phenomenon.at("name", default: "")*]

    *הסבר קצר על התופעה: * #phenomenon.at("explanation", default: "")

    *דוגמאות לתופעה:*

    #eval(phenomenon.at("examples", default: ""), mode: "markup")

    *חשיבות התופעה לקצין בצבא ההגנה לישראל:* #phenomenon.at("importance", default: "")

    #if phenomenon.at("extras", default: "") != "" [
      *נוסף:* #phenomenon.at("extras", default: "")
    ]


  ]

    *הערכה כללית על ההתנסות:*

    #eval(overview, mode: "markup")
]

#let middle-review(general-feelings: "", personal-goals: "", good: "", bad: "", feeling-in-group: "", feeling-officers: "", important-moment: "", future-tasks: "", notes: "") = [
  + *מטרה:* מוכנות הצוער לחוו״ד האמצע מול המפק״ץ, יעילות המופע ועיבוד אישי של ההכשרה עד כאן.
  + *כללי*

    + *תחושות כלליות:* #general-feelings
    + *התייחסויות ליעדים האישיים שנקבעו בתחילת ההכשרה ואיפה אני מרגיש/ה שאני עומד/ת מולם?*

      #eval(personal-goals, mode: "markup")
    + *לשימור*

      #eval(good, mode: "markup")
    + *לשיפור*

      #eval(bad, mode: "markup")
  + *איך אני מרגיש/ה בפלוגה ובצוות?* #feeling-in-group
  + *איך אני מרגיש/ה אל מול הסגל (מפק״ץ/מ״פ)?* #feeling-officers
  + *רגע או תוכן בהכשרה שהיו משמעותיים עבורי:* #important-moment
  + *דיוק יעדים להמשך: במה אני הולכ/ת להתמקד בהמשך הדרך?* #future-tasks
  + *התייחסויות נוספות*

    #eval(notes, mode: "markup")
]

#let safra-veseifa(question-1: "", question-2: "", question-3: "", question-4: "", question-5: "", book-name: "", book-cover: "", author-hierarchy: "") = [
  #if book-name != "" [
    #set align(center)
    #set text(size: 24pt)

    #v(-0.5em)

    #if book-cover != "" [
      #box(height: 10cm, image(book-cover))
    ]

    #v(-0.75em)

    *#book-name*
    
    #v(-0.75em)

    #context { s("מגיש: ", "מגישה: ") + author-state.final() }

    #v(-0.75em)

    #author-hierarchy

    #pagebreak()
  ]

  + #eval(question-1, mode: "markup")
  + #eval(question-2, mode: "markup")
  + #eval(question-3, mode: "markup")
  + #eval(question-4, mode: "markup")
  + #eval(question-5, mode: "markup")
]

#let opinion-paper(introduction: "", background: "", problem-definition: "", topic: "", objectives: "", base-assumptions: "", work-assumptions: "", methods: "", alternatives: "", alternative-analysis-a: "", conclusions-a: "", alternative-analysis-b: "", conclusions-b: "", sensitivity: "", recommendations: "", conclusion: "", bibliography: "") = [
  *מבוא*

  #eval(introduction, mode: "markup")

  *רקע*

  #eval(background, mode: "markup")

  *הגדרת הבעיה*

  #eval(problem-definition, mode: "markup")

  *נושא העמ״ט*

  #eval(topic, mode: "markup")

  *מטרות העמ״ט*

  #eval(objectives, mode: "markup")

  *הנחות יסוד*

  #eval(base-assumptions, mode: "markup")

  *הנחות עבודה*

  #eval(work-assumptions, mode: "markup")

  *שיטות עבודה*

  #eval(methods, mode: "markup")

  *הצגת החלופות*

  #eval(alternatives, mode: "markup")

  *ניתוח החלופות והשוואה ביניהן - שיטה א׳*

  #eval(alternative-analysis-a, mode: "markup")

  *מסקנות ופתרונות - שיטה א׳*

  #eval(conclusions-a, mode: "markup")

  *ניתוח החלופות והשוואה ביניהן - שיטה ב׳*

  #eval(alternative-analysis-b, mode: "markup")

  *מסקנות ופתרונות - שיטה ב׳*

  #eval(conclusions-b, mode: "markup")

  *ניתוח רגישות*

  #eval(sensitivity, mode: "markup")

  *המלצות*

  #eval(recommendations, mode: "markup")

  *סיכום*

  #eval(conclusion, mode: "markup")

  *ביבליוגרפיה*

  #eval(bibliography, mode: "markup")
]

#let form-24(event-date: "", fire-area: "", staff-count: "", soldiers-count: "", ratio: "", outdoor-ratio: "", expected-weather: "", required-preparations: "", required-approvals: "", neighbor-forces: (), driver-phone: "", paramedic-phone: "", evacuation-destination: "", health-conditions: "", pod-scan: "", emergency-squad: "", training-framework: "", staff-status: "", neighbor-forces-status: "", equipment-status: "", risk: (), approval-notes: "", contact-list: ()) = [
  #let placeholder = box(stroke: (bottom: 1pt), width: 30pt)
  #let signature-line = [*תאריך:* #placeholder #h(1fr) *שם מלא:* #placeholder #h(1fr) *יחידה:* #placeholder #h(1fr) *דרגה:* #placeholder #h(1fr) *תפקיד:* #placeholder #h(1fr) *חתימה:* #placeholder #h(1fr)]

  + *המפקד*
    + עליך לקרוא וללמוד היטב את תיק המטווח בו אתה עתיד להתאמן ולבצעו ככתוב.
    + נספח זה ימולא ע"י מנהל המטווח על בסיס תיק המטווח, ובהתאם להנחיות מפקד האימון.
    + עליך למלא את הנספח תוך ניתוח הסיכונים על פי הסעיפים המופיעים בו בהמשך.
    + לאחר אישור נספח 24 על ידי מאשר האימון, כלל הרשום הינו בגדר פקודה ומחויב ביצוע ביום האימון עצמו ובהכנות לאימון.
    + הנספח יאושר ב-24 השעות שיקדמו למטווח.
  + *סעיף זה ימולא ע״י מנהלי המטווח*
    #v(-0.75em)
    תיק התרגיל נקרא על ידי והובן וכן בוצעו כל ההכנות המחייבות על פי הוראות הבטיחות לקראת התרגיל וכן ע״פ #underline[תיק המטווח והנחיות מ. האימון].
    #v(-0.75em)
    #signature-line
    #v(-0.75em)
    #signature-line
    #v(-0.75em)
    #signature-line
  + *סעיף זה ימולא ע״י מפקד האימון*
    #v(-0.75em)
    תיק התרגיל נקרא על ידי והובן וכן בוצעו כל ההכנות המחייבות על פי הוראות הבטיחות לקראת התרגיל וכן ע״פ #underline[תיק המטווח].
    #v(-0.75em)
    #signature-line
  + *סעיף זה ימולא ע״י מפקדו של מפקד האימון*
    #v(-0.75em)
    בוצע אישור תוכניות והוצג נספח 24, כמו כן פורטו ההנחיות והמגבלות לביצוע.
    #v(-0.75em)
    #signature-line
  + *כללי*
    + תאריך המטווח - #event-date
    + שטח אש - #fire-area
    + סד״כ סגל - #staff-count
    + סד״כ חיילים - #soldiers-count
    + יחס חניכה במטווח - #ratio
    + חניכה בחצר האחורית - #outdoor-ratio
  + *מז״א*
    + מז״א צפוי - #expected-weather
    + הכנות וציוד נדרש - #required-preparations
    + מגבלות ואישורים נדרשים - #required-approvals
  + *כוחות שכנים*
    + ינותח וימולא ע״י מפקד/ת האימון.
    + נתח/י את נושא הכוחות השכנים, הצמודים או הסמוכים לשטח ביצוע התרגיל.
    + פרט/י בטבלה:

      #table(
        columns: (1fr, 1fr, 1fr, 1fr, 1fr),
        [שם הכוח], [אות קריאה וקשר], [מיקומו], [התניות, ג״ג], [הערות],
        ..neighbor-forces.map((force) => (
          [#force.at("name", default: "")],
          [#force.at("frequency", default: "")],
          [#force.at("location", default: "")],
          [#force.at("borders", default: "")],
          [#force.at("notes", default: "")],
        )).flatten(),
      )
  + *וידוא מוכנות לשטח*

    #table(
      columns: (1fr, 1fr, 1fr),
      [מס״ד], [בעל תפקיד], [פרטים/טלפון],
      [1], [רכב ונהג פינוי], [#driver-phone],
      [2], [חובש/ת תורנ/ית בשטח], [#paramedic-phone],
      [3], [יעד פינוי], [#evacuation-destination],
      [4], [כשירות רפואית של החיילים], [#health-conditions],
      [5], [סריקת נפלים (מי? מתי?)], [#pod-scan],
      [6], [אבטחת אמת (כ״כ)], [#emergency-squad],
    )
  + *ניהול סיכונים משתנים*
    + המסגרת המאמנת - #training-framework
    + מצב הסגל - #staff-status
    + כוחות שכנים - #neighbor-forces-status
    + ציוד - #equipment-status
    + #risk-management(risk: risk)
  + *דגשי מאשר האימון*

    #eval(approval-notes, mode: "markup")
  + *נספח דרכ״ש*

    #table(
      columns: (1fr, 1fr, 1fr, 1fr),
      [מספר אישי], [שם פרטי], [שם משפחה], [טלפון],
      ..contact-list.map((contact) => (
        [#contact.at("personal-number", default: "")],
        [#contact.at("name", default: "")],
        [#contact.at("family-name", default: "")],
        [#contact.at("phone", default: "")],
      )).flatten()
    )
]

#let form-870(date: "", force: "", unit: "", course: "נחשון", author-first-name: "", author-phone-number: "", cadet-first-name: "", cadet-number: "", months-under-command: "", familiarity: "", current-job-title: "", strength: (), weakness: (), ratings-1: "", ratings-2: "", ratings-3: "", ratings-4: "", ratings-5: "", ratings-6: "", ratings-7: "", ratings-8: "", ratings-9: "", ratings-10: "", motivation-for-course: "", difficulty-areas: "", relative-quality: "", accept-as-your-worker: "", higher-authority-first-name: "", higher-authority-phone-number: "", higher-authority-familiarity: "", higher-authority-familiarity-months: "", higher-authority-fitness-assessment: "", higher-authority-accept-as-your-worker: "", higher-authority-notes: "") = [
  #set page(
    flipped: true,
    columns: 2,
    margin: 1cm,
  )
  #set text(
    size: 10pt,
    lang: "he",
    font: "David CLM"
  )
  #set par(
    spacing: 0.8em,
  )
  #let ratings = (ratings-1, ratings-2, ratings-3, ratings-4, ratings-5, ratings-6, ratings-7, ratings-8, ratings-9, ratings-10)

  #let x-box = box(width: 100%, height: 100%, {
    place(line(start: (0%, 0%), end: (100%, 100%)))
    place(line(start: (0%, 100%), end: (100%, 0%)))
  })

  #let multiple(chosen, options) = {
    for option in options {
      box(table(columns: (auto, auto), stroke: none, align: horizon, inset: 0pt, {
        box(width: 10pt, height: 10pt,  stroke: 1pt, { if option == chosen { x-box } else { none }})
      
        h(5pt)
      },
      { option }))

      h(5pt)
    }
  }
  #let multiple-table(title, options, labels, chosen) = {
    table(
      columns: (1fr, ) + options.map((option) => if option.len() > 20 { 50pt } else { 30pt }),
      align: center + horizon,
      title, ..options,
      ..labels.zip(chosen).map(((label, choice)) => {
        (label, ) + options.map((option) => {
          if option == choice {
            [X]
          }
        })
      }).flatten()
    )
  }

  *תאריך:* #date #h(1fr) *חיל:* #force #h(1fr) *יחידה:* #unit #h(1fr) *מיועד לקורס:* #course

  = #table(columns: (20pt + 1em, 1fr), stroke: none, inset: 0pt, align: horizon, box(height: 20pt, image("assets/idf-logo.png")), [חוות דעת על מועמד/ת לקורס קצונה])

  כמפקד/ת, חוות הדעת שלך אודות המועמד/ת מהווה כלי חשוב בעיצוב דור הקצינים והקצינות הבא של צה״ל. לכן, ככל שההערכות יהיו מדויקות יותר, כך תתאפשר קבלת החלטות נכונה ואחראית, הן כלפי המערכת והן כלפי המועמד/ת.

  *פרטי המועמד/ת*

  *שם פרטי בלבד:* #underline[#cadet-first-name] #h(20pt) *מספר אישי:* #underline[#cadet-number]

  == חלק א׳: חוות דעת המפקד/ת הישיר/ה (קצין/ה או נגד/ת)

  *החייל/ת משרת/ת תחת פיקודי* #underline[#months-under-command] חודשים.

  *מידת היכרותי עם החייל/ת:* 

  #multiple(familiarity, ("טובה מאוד", "די טובה", "בינונית", "קלושה"))

  *תפקידו/ה הנוכחי של החייל/ת (פירוט ברמת בלמ״ס בלבד):* #underline[#current-job-title]

  #v(1fr)

  *1. תאר/י את המועמד/ת בטבלה הבאה, תוך התייחסות ל-2 נקודות חוזק ו-2 נקודות חולשה וכיצד הן באות לידי ביטוי על ידי הסבר או דוגמה.*

  #table(
    columns: (1fr, 2fr, 4fr),
    align: center + horizon,
    [], [*מאפייני החייל/ת*], [*הסבר/דוגמה*],
    table.cell(rowspan: strength.len())[*נקודות חוזק*], ..strength.enumerate().map(((index, s)) => ([#(index + 1). #s.at("property", default: "")], [#s.at("descriptionOrExample", default: "")])).flatten(),
    table.cell(rowspan: weakness.len())[*נקודות חולשה*], ..weakness.enumerate().map(((index, s)) => ([#(index + 1). #s.at("property", default: "")], [#s.at("descriptionOrExample", default: "")])).flatten(),
    // table.cell(rowspan: 2)[*נקודות חולשה*], [1. #weakness.at(0).at("property")], [#weakness.at(0).at("descriptionOrExample")],
    // [2. #weakness.at(1).at("property")],
    // [#weakness.at(1).at("descriptionOrExample")],
  )

  *2. דרג/י את החייל/ת לפי המאפיינים הבאים (סמן/י X במשבצת המתאימה). שים/י לב! ניתן לבחור עד שלושה מאפיינים בקטגוריה ״גבוה מאוד״ ועד שלושה מאפיינים בקטגוריה ״גבוה״.*

  #multiple-table(
    "מאפיין",
    ("גבוה מאוד", "גבוה", "בינוני", "נמוך", "נמוך מאוד", "לא ניתן להעריך/לא רלוונטי"),
    ("עצמאות בביצוע משימות", "תפקוד יעיל בלחץ ועומס", "קבלת החלטות", "משמעת והסתגלות לצרכי המערכת", "יכולת חשיבה ולמידה עצמית", "עבודת צוות", "אומץ, איתנות וקור רוח (רק לקרביים)", "אסרטיביות ויכולת הובלה", "אחריות והשקעה במשימה", "קבלת ביקורת"),
    ratings
  )

  #colbreak()

  *3. מה מידת המוטיבציה של החייל/ת לצאת קצונה?*

  #multiple(motivation-for-course, ("גבוהה מאוד", "גבוהה", "בינונית", "נמוכה", "אינו/ה רוצה לצאת קצונה"))

  *4. באילו תחומים עלול/ה החייל/ת להתקשות בקורס קצינים/בתפקיד?*

  #difficulty-areas

  *5. באיזו מידה מתאים/ה המועמד/ת לקצונה ביחס לחיילים האחרים?*

  #multiple(relative-quality, ("יותר מרוב החיילים בתפקידים דומים", "כמו רוב החיילים בתפקידים דומים", "פחות מרוב החיילים בתפקידים דומים", "אינו/ה מתאים/ה כלל לקצונה"))

  *6. באיזו מידה תהיה/י מוכן/ה לקבל את החייל/ת כקצין/ה תחת פיקודך?*

  #multiple(accept-as-your-worker, ("במידה רבה מאוד", "במידה רבה", "במידה בינונית", "במידה מועטה", "איני מעוניין/ת כלל"))

  *פרטי המפקד/ת הישיר/ה*

  *שם פרטי בלבד:* #underline[#author-first-name] #h(20pt) *טלפון:* #underline[#author-phone-number]

  #v(1em)

  *שים/י לב! תוכן הטופס חסוי וישמש את הגורמים המקצועיים בלבד. עם זאת, חובה להביא את החוו״ד לעיונו של המועמד ולבצע שיחת משוב לחוות הדעת שנכתבה!*

  חתימת המועמד/ת או הצהרת המפקד/ת שנערכה שיחת משוב לחוות הדעת

  *שם פרטי בלבד:* #underline[#author-first-name] #h(20pt) *חתימה:* #underline(h(80pt)) #h(1fr)

  #v(1fr)

  == חלק ב׳: חוות דעת המפקד/ת של המפקד/ת הישיר/ה

  *1. משך היכרותך עם החייל בחודשים:* #underline[#higher-authority-familiarity-months]

  *מידת ההיכרות:* #multiple(higher-authority-familiarity, ("טובה מאוד", "די טובה", "בינונית", "קלושה", "איני יכול/ה להעריך"))

  *2. תאר/י את מידת ההתאמה של החייל/ת לקצונה, תוך התייחסות לנקודות חוזק וחולשה שלו/ה.*

  #underline[#higher-authority-fitness-assessment]

  *3. באיזו מידה תהיה/י מוכן/ה לקבל את המועמד/ת כקצין/ה תחת פיקודך (ללא קשר לאילוצי כ״א)?*

  #multiple(higher-authority-accept-as-your-worker, ("במידה רבה מאוד", "במידה רבה", "במידה בינונית", "במידה מועטה", "איני מעוניין/ת כלל"))

  *4. הערות נוספות:* #underline[#higher-authority-notes]

  *פרטי המפקד/ת של המפקד/ת הישיר/ה*

  *שם פרטי בלבד:* #underline[#higher-authority-first-name] #h(20pt) *טלפון:* #underline[#higher-authority-phone-number]
]

#let independence-day-award-recommendation(commander-name: "", commander-job: "", soldier-name: "", soldier-job: "", familiarity-time: "", is-outstanding: "", is-central-figure: "", is-team-player: "", did-initiate: "", did-mentor: "", is-leader: "", extra: "", outstanding-attribute: "") = [
  + *פרטי המפקד/ת והחייל/ת*

    #table(
      columns: (1fr, 1fr),
      [*שם המפקד/ת*], [#commander-name],
      [*תפקיד המפקד/ת*], [#commander-job],
      [*שם החייל/ת*], [#soldier-name],
      [*תפקיד החייל/ת*], [#soldier-job],
      [*זמן ההיכרות המקצועית*], [#familiarity-time],
    )
  + *מאפיינים מקצועיים*
    + *האם החייל/ת בולט באיכות ומקצועיות עבודתו?* נמק/י.

      #eval(is-outstanding, mode: "markup")
  + *מאפיינים תעסוקתיים אישיים*
    + *האם החייל/ת מהווה גורם מרכזי ביחידה (דוגמה אישית, דמות סמכות וכדומה)?* פרט/י ונמק/י.

      #eval(is-central-figure, mode: "markup")
    
    + *האם המועמד/ת תורמ/ת ומעודד/ת עבודת צוות (אוירה טובה, נעזרים בעמיתיהם וכדומה)?* פרט/י ונמק/י.

      #eval(is-team-player, mode: "markup")
  + *יוזמות/שינויים/פרויקטים*
    + *האם יזמ/ה שינוי משמעותי ו/או קידום משמעותי בתהליכי עבודה, אילו תוצאות הניבו יוזמות אלו?*

      #eval(did-initiate, mode: "markup")
  + *חניכה*
    + *האם חנכ/ה חייל/ת חדש/ה ו/או חנכ/ה חייל/ת חניכה מקצועית?* אנא פרט/י.

      #eval(did-mentor, mode: "markup")
  + *מאפיינים ניהוליים (במידה ולמועמד/ת יש לפחות כפיפ/ה אחד/אחת)*
    + *האם החייל נתפס כממונה המגלה כושר הובלה ומנהיגות, מעודד ודוחף את חייליו למצוינות ומעודד חדשנות וכדומה?* פרט/י ונמק/י.

      #eval(is-leader, mode: "markup")
  + *התייחסות פתוחה*
    + *במידה ויש מידע חשוב נוסף אשר בגינו הינך חושב/ת שהמועמד/ת ראוי/ה להיבחר כחייל/ת מצטיינ/ת, ולא ניתן לו המקום, עד כה, אנא פרט/י ונמק/י.*

      #eval(extra, mode: "markup")
  + *הצטיינות*
    + *מהו המאפיין העיקרי בגינו הינך חושב שהעובד/ת בולט/ת מעל כל החיילים, אשר מזכה אותם להיות חיילים מצטיינים?*

      #eval(outstanding-attribute, mode: "markup")
]

#let form-d1(unit-details: "", event-details: "", event-location: "", event-participants: "", event-schedule: "", event-date: "", food-and-drink: "", event-instructor: "", dress-code: "", gift-distribution: "", safety-officer: "", medical-response: "", weather-forecast: "", weather-notes: "", physical-effort: "", security-notes: "", transportation: "", safety-issues: (), safety-book: "") = [
  + *כללי*
    + *פרטי היחידה הצבאית:* #unit-details
    + *פרטי סוג הפעילות:* #event-details
    + *מיקום ומסלול הפעילות:* #event-location
    + *משתתפי הטיול וסה״כ סד״כ מתוכנן:* #event-participants
    + *לו״ז הפעילות*

      #eval(event-schedule, mode: "markup")
    + *מועד ושעות הפעילות:* #event-date
    + *מענה מזון ושתייה:* #food-and-drink
    + *מענה ההדרכה:* #event-instructor
    + *אופן הלבוש ודגשים אחרים:* #dress-code
    + *חלוקת תשורה:* #gift-distribution
  + *מענה הבטיחות*
    + *קצין הבטיחות:* #safety-officer
    + *מענה רפואי*: #medical-response
    + *תחזית מטאורולוגית צפויה ליום הפעילות:* #weather-forecast
    + *דגשים הנוגעים למזג האוויר*
      
      #eval(weather-notes, mode: "markup")
    + *דגשים הנוגעים למאמץ פיזי*
    
      #eval(physical-effort, mode: "markup")
    + *דגשים הנוגעים לאבטחה*

      #eval(security-notes, mode: "markup")
    + *מענה ההיסעים ודרכי הגעה*

      #eval(transportation, mode: "markup")
    + *ניתוח נקודות התורפה הבטיחותיות (נת״בים) נוספות בפעילות:*

      #table(
        columns: (1fr, 1fr, 1fr, 1fr, 1fr),
        [מס״ד], [שלב בפעילות], [תיאור הנת״ב], [פעילות מניעה ובקרה], [הערות],
        ..safety-issues.enumerate().map(((index, issue)) => (
          [#(index + 1)],
          [#issue.at("stage", default: "")],
          [#issue.at("description", default: "")],
          [#issue.at("preventive-action", default: "")],
          [#issue.at("notes", default: "")],
        )).flatten(),
      )
    + *במקרה של סיור במכון/באתר מורשת/נופש במתקני ״יחד למען החייל״:* #safety-book
]

#let special-population-meeting-summary(personal-number: "", soldier-name: "", marital-status: "", date-of-enlistment: "", address: "", job-title: "", special-population-type: "", family-background: "", aliyah: "", address-details: "", family-support: "", needs-housing: "", is-satisfied-housing: "", financial-difficulties: "", work-permit: "", financial-support: "", social-adjustment: "", tash-satisfaction: "", issues: "", evacuation-time: "", evacuation-benefits: "", parents-job: "", evacuation-registered: "", difficult-issues: "", evacuation-job-issues: "", submission-date: "") = [
  #set table(
    fill: none
  ) 
  #show table.cell: set text(weight: "regular")

  #table(
    columns: 12 * (1fr, ),
    table.cell(colspan: 3)[*מספר אישי*],
    table.cell(colspan: 3)[*שם החייל/ת*],
    table.cell(colspan: 3)[*מצב משפחתי*],
    table.cell(colspan: 3)[*תאריך גיוס*],
    table.cell(colspan: 3)[#personal-number],
    table.cell(colspan: 3)[#soldier-name],
    table.cell(colspan: 3)[#marital-status],
    table.cell(colspan: 3)[#date-of-enlistment],
    table.cell(colspan: 4)[*כתובת מגורים*],
    table.cell(colspan: 4)[*תפקיד החייל/ת ביחידה*],
    table.cell(colspan: 4)[*סוג אוכלוסיה מיוחדת*],
    table.cell(colspan: 4)[#address],
    table.cell(colspan: 4)[#job-title],
    table.cell(colspan: 4)[#special-population-type],
  )

  + *רקע כללי*
    + רקע משפחתי: #family-background
    + באם החייל/ת עולה חדש/ה - האם עלו ארצה בגופם, ארץ עלייה, מועד עלייה, באילו קשיים נתקלו בארץ ובמהלך שירותם הצבאי: #aliyah
    + מקום מגורי החייל: #address-details
    + *באם החייל/ת מתגורר עם משפחתו*
      + האם קיים גורם אשר זקוק לתמיכת החייל/ת? אם כן, פרט/י: #family-support
      + האם זקוק/ה לפתרון דיור צה״לי? מדוע? #needs-housing
    + באם החייל/ת מתגורר/ת בפתרון דיור צה״לי - האם הם שבעי רצון מפתרון זה? האם הם מעוניינים בפתרון דיור חלופי?

      #eval(is-satisfied-housing, mode: "markup")
  + *מצב כלכלי*
    + האם החיל/ת נתקל בקשיים כלכליים מיוחדים? אם כן, כיצד הם באים לידי ביטוי? #financial-difficulties
    + האם לחייל/ת היתר עבודה? אם כן, האם הם מממשים אותו? אם לא, מדוע? #work-permit
    + האם החייל/ת מימש/ה אחד מערוצי הסיוע הבאים: חופשה מיוחדת כלכלית/מענק/הלוואה/מענקי מזון/קרן סיוע? אם לא, האם מעוניינ/ת באחד מערוצים אלו? פרט/י: #financial-support
  + *הסתגלות החייל/ת ביחידה*
    + הסתגלות חברתית של החייל/ת ביחידה (מצב חברתי, האם החייל/ת מרוצה בשיבוצם): #social-adjustment
    + הטבות ת״ש - האם החייל/ת שבעי רצון מטיפול הת״ש ביחידה? #tash-satisfaction
    + בעיות אשר החייל/ת העלו ונושאים לטיפול: #issues
  + *אוכלוסיית מפונים*
    + כמה זמן משפחת החייל/ת מפונה מביתם? #evacuation-time
    + האם משפחת החייל/ת מקבלת את ההטבות שזכאית אליהן מטעם המדינה? #evacuation-benefits
    + האם הורי החייל/ת עזבו את מקום עבודתם? האם הם מודעים שעשויים להיות זכאים למענק חזרה לעבודה? #parents-job
    + האם משפחת החייל/ת נרשמו כמפונים דרך הביטוח הלאומי? #evacuation-registered
    + האם קיימות בעיות חריגות? #difficult-issues
    + העם בעקבות הפינוי קיימת מורכבות עם שיבוץ החייל/ת? #evacuation-job-issues
  + איחלתי לחייל/ת בהצלחה.
  + *העברתי את פורמט סיכום הראיון לידי מש״קית הת״ש בתאריך #submission-date.*

  #post-signature-state.update([
    #rect(width: 100%, inset: 1em)[
      *התייחסות מש״קית הת״ש:* #underline(stroke: black, text(white)[#range(222).map((_) => "_ ").join("")])

      *צעדים להמשך טיפול:* #underline(stroke: black, text(white)[#range(45).map((_) => "_ ").join("")])
    ]

    #rect(width: 100%, inset: 1em)[
      *התייחסות קצינת ת״ש (תקינות הראיון, פתיחת בקשות/החתמת ויתור):* #underline(stroke: black, text(white)[#range(135).map((_) => "_ ").join("")])

      #v(1em)

      #set table(
        fill: none
      ) 

      #table(
        columns: (1.5fr, 1fr, 1.5fr, 1.5fr),
        column-gutter: 1em,
        stroke: (x, y) => if (y == 1) { (top: 1pt) } else { none },
        [], [], [], [],
        [שם + משפחה], [מספר אישי], [תאריך], [חתימה],
      )
    ]
  ])
]

#let trip-plan(sections: (), map-image: "", ..ignored) = [
  #if map-image != "" [
    #set align(center)
    #box(height: 18cm, image(map-image))
  ]

  #let point-counter = counter("point-counter")
  #point-counter.step()
  #for section in sections [
    #eval(section.at("description", default: ""), mode: "markup")
    #context enum(
      start: point-counter.get().at(0),
      ..section.at("points", default: ()).enumerate().map(((index, point)) => enum.item[
        #let point-split = point.at("coordinates", default: "").split(",").map((x) => x.trim())

        *נ״צ #(point-counter.get().at(0) + index): #point.at("name", default: "")*
        #h(1fr)
        #if point-split.len() == 2 [
          #link("https://ul.waze.com/ul?ll=" + str(point-split.at(0)) + "%2C" + str(point-split.at(-1)) + "&navigate=yes")[Waze]
          #sym.circle.filled.small
          #link("https://www.google.com/maps/dir/?api=1&destination=" + point.at("coordinates", default: ""))[Google Maps]
        ]

        #eval(point.at("description", default: ""), mode: "markup")
      ])
    )
    #point-counter.update(c => c + section.at("points", default: ()).len())
  ]
]
`.trim()

export const compileDocument = async (document: OCDocument) => {
  const settings = {
    ...getLocalStorage<Settings>("Settings"),
    ...(document.settings ?? {}),
  }
  const parameters: Record<string, any> = {
    author: settings.fullName ? settings.fullName : "ללא שם",
    title: document.title,
    secretness: document.secretness ?? 'בלמ"ס',
    "for-civillians": document.forCivillians ?? false,
    to: document.to ?? "",
    da: document.da ?? "",
    signature: settings.signature
      ? `signature.${settings.signatureExtension ?? "png"}`
      : "",
  }
  if (document.date) {
    const date = new Date(document.date)
    const hebdate = formatJewishDateInHebrew(toJewishDate(date))
      .replace("חשון", "מרחשוון")
      .split(" ")
    parameters.hebdate = [hebdate[0], "ב" + hebdate[1], hebdate[2]]
    parameters.engdate = [
      date.getDate().toString(),
      "ב" + ENGLISH_MONTHS[date.getMonth()],
      date.getFullYear().toString(),
    ]
  }

  const compiler = window.typstCompiler
  if (!compiler) {
    return
  }
  try {
    compiler.mapShadow(
      `/signature.${settings.signatureExtension ?? "png"}`,
      Uint8Array.from(atob(settings.signature ?? ""), (c) => c.charCodeAt(0)),
    )
  } catch (ignored) {}
  compiler.addSource("/parameters.json", JSON.stringify(parameters))
  const templateParameters = JSON.parse(
    JSON.stringify(document.parameters ?? {}),
  )
  const templates = getTemplates()
  const translateParameters = async (
    paramInfos: TemplateParameter[],
    parameters: Record<string, any>,
  ) => {
    for (const key in parameters) {
      if (typeof parameters[key] === "string") {
        parameters[key] = parameters[key].replace(/\t/g, "    ")
      }

      const p = paramInfos.find((x) => x.name === key)
      if (p === undefined) {
        delete parameters[key]
        continue
      }

      if (p.isTypst) {
        try {
          const d: JSONContent = JSON.parse(parameters[key])
          parameters[key] = tiptapToTypst(d)

          await fetchAllImages(d)
        } catch (e) {
          console.log(e)
        }
      }

      if (p.isImage && parameters[key] != "") {
        try {
          const r = await fetch(parameters[key])
          const v = await r.arrayBuffer()
          const fname =
            p.name + "." + TYPE_TO_EXTENSION[r.headers.get("Content-Type")!]
          compiler.mapShadow("/" + fname, new Uint8Array(v))
          parameters[key] = fname
        } catch (e) {
          delete parameters[key]
          showFailureMessage(`לצערי לא ניתן להשיג את התמונה שהוזנה ב${p.label}`)
        }
      }

      if (p.children && p.variadic) {
        for (const v of parameters[key]) {
          await translateParameters(p.children, v)
        }
      }
    }
  }
  const postprocess = templates[document.type].postprocess
  await translateParameters(
    templates[document.type].parameters,
    templateParameters,
  )
  if (postprocess) {
    try {
      await postprocess(templateParameters)
    } catch (e) {
      console.log(e)
    }
  }

  if (templates[document.type].typstPreamble) {
    compiler.addSource(
      "/lib.typ",
      LIBRARY_CODE + "\n\n" + templates[document.type].typstPreamble,
    )
  }

  compiler.addSource(
    "/templateParameters.json",
    JSON.stringify(templateParameters),
  )
  const logos = []
  const promises: Promise<void>[] = []
  let i = 0
  for (const logo of settings.logos ?? []) {
    const logoName = `assets/logo-${i}.${logo.split(".").at(-1)}`
    promises.push(
      fetch(logo)
        .then((r) => r.arrayBuffer())
        .then((v) => compiler.mapShadow("/" + logoName, new Uint8Array(v))),
    )
    i++
    logos.push(logoName)
  }
  await Promise.all(promises)

  compiler.addSource(
    "/main.typ",
    `
  #import "lib.typ": *
  
  #show: if not-idf-document.at("${document.type}", default: none) == none { idf-document.with(
    author: ${JSON.stringify(settings.fullName ?? "")},
    job-title: ${JSON.stringify(settings.jobTitle ?? "")},
    sender-details: ${JSON.stringify(settings.senderDetails ?? "")},
    rank: ${JSON.stringify(settings.rank ?? "")},
    sex: ${JSON.stringify(settings.sex ?? "זכר")},
    logos: (${logos.length > 0 ? logos.map((v) => JSON.stringify(v)).join(", ") + "," : ""}),
    signature-width: ${settings.signatureWidth ?? 4},
    use-david-clm: ${settings.useDavidCLM ?? false},
    compact: ${settings.compact ?? false},
    slogan: ${JSON.stringify(settings.slogan ?? "")},
    ..json.decode(read("parameters.json"))
  ) } else { (body) => body }
  
  #${document.type}(..json.decode(read("templateParameters.json")))
        `.trim(),
  )
  try {
    const result = await compiler.compile({
      format: "pdf",
      mainFilePath: "/main.typ",
      diagnostics: "none",
    })
    return result.result
  } catch (e) {
    showFailureMessage(
      `אוי לא! הייתה שגיאה במהלך הכנת המסמך, אנא צלמו את זה ושלחו למפתחים:\n${e}`,
    )
  }
}
