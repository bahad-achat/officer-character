import { Anchor } from "@mantine/core"

const HomePage = () => {
  return (
    <>
      <div style={{ textAlign: "center" }}>
        <p style={{ marginTop: 10 }}>
          ברוכים הבאים ל-<b>דמות הקצין</b>!
        </p>
        <p>
          באתר תוכלו לכתוב מסמכים בצורה נוחה והוא יעזור לכם לייצר אותם עם כתיבה
          צבאית נכונה.
        </p>
        <p>
          למסמך הוראות שימוש באתר{" "}
          <Anchor style={{ fontSize: "inherit" }} href="/instructions.pdf">
            לחצו כאן!
          </Anchor>
        </p>
        <img
          src="/guide.png"
          width={500}
          style={{ marginTop: 10, maxWidth: "95%" }}
        />
      </div>
    </>
  )
}

export default HomePage
