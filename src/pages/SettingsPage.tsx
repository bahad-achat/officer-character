import { Button, ButtonGroup, Loader, Switch, Tooltip } from "@mantine/core"
import Container from "../components/Container"
import FontAwesome from "../components/FontAwesome"
import {
  getLocalStorage,
  setLocalStorage,
  useCurrentUser,
  useLocalStorage,
} from "../hooks"
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth"
import { auth, firestore } from "../firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { useState } from "react"
import {
  getLocalStorageCopy,
  promiseToSuccessPromise,
  setLocalStorageCopy,
} from "../utilities"
import { showSuccessOrFailure } from "../ui-utilities"
import { Dropzone } from "@mantine/dropzone"
import { modals } from "@mantine/modals"
import SettingsEditor from "../components/SettingsEditor"
import version from "../version.json"
import { offline } from "../config"

export interface CustomLogo {
  id: string
  name: string
  data: string
  extension: string
}

export interface Settings {
  rank?: string
  jobTitle?: string
  slogan?: string
  senderDetails?: string
  fullName?: string
  logos?: string[]
  uploadedLogos?: CustomLogo[]
  sex?: string
  signatureWidth?: number
  useDavidCLM?: boolean
  compact?: boolean
  signature?: string
  signatureExtension?: string
}

const google = new GoogleAuthProvider()

const SettingsPage = () => {
  const [settings, setSettings] = useLocalStorage<Settings>({
    key: "Settings",
    defaultValue: {},
  })
  const [isTutorial, setIsTutorial] = useLocalStorage<boolean>({
    key: "Is Tutorial",
    defaultValue: true,
  })
  const [showPreview, setShowPreview] = useLocalStorage<boolean>({
    key: "Show Preview",
    defaultValue: true,
  })
  const [currentUser, loadingCurrentUser] = useCurrentUser()
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  return (
    <Container>
      <h1 style={{ textAlign: "center" }}>הגדרות</h1>
      <SettingsEditor settings={settings} setSettings={setSettings} />
      <h3 style={{ marginTop: 10, textAlign: "center" }}>שימוש באתר</h3>
      <Switch
        label="מצב הדרכה (הסברים על כל שדה ותיקון שגיאות)"
        checked={isTutorial}
        onChange={(e) => setIsTutorial(e.currentTarget.checked)}
      />
      <Switch
        mt="xs"
        label="תצוגה מקדימה"
        checked={showPreview}
        onChange={(e) => setShowPreview(e.currentTarget.checked)}
      />

      {!offline && (
        <h3 style={{ marginTop: 10, textAlign: "center" }}>סנכרון</h3>
      )}
      {loadingCurrentUser && <Loader />}
      {!loadingCurrentUser && !currentUser && !offline && (
        <Button
          fullWidth
          leftSection={<FontAwesome kind="brands" icon="google" />}
          mt="xs"
          onClick={() => signInWithPopup(auth, google)}
        >
          התחברות עם Google
        </Button>
      )}
      {!loadingCurrentUser && currentUser && !offline && (
        <>
          <ButtonGroup orientation="vertical" mt="xs" mb="md">
            <Tooltip label="שומר את כל המסמכים בצורה לא מוצפנת בשרתים של גוגל ומוחק את המסמכים ששמורים שם כרגע. משתמשים אחרים לא יכולים לראות את המסמכים. בנוסף שומר את ההגדרות. החתימה לא נשמרת בשרת.">
              <Button
                loading={uploading}
                leftSection={<FontAwesome icon="floppy-disk" />}
                onClick={async () => {
                  setUploading(true)
                  const data: any = {
                    documents: getLocalStorage("Documents"),
                  }
                  if (settings.fullName) {
                    data.fullName = settings.fullName
                  }
                  if (settings.sex) {
                    data.sex = settings.sex
                  }
                  if (settings.signatureWidth) {
                    data.signatureWidth = settings.signatureWidth
                  }

                  const successPromise = promiseToSuccessPromise(
                    setDoc(doc(firestore, `/users/${currentUser}`), data),
                  )
                  showSuccessOrFailure(
                    successPromise,
                    "המידע בגוגל מעודכן כעת.",
                    "אנא נסו שנית.",
                  )
                  await successPromise
                  setUploading(false)
                }}
              >
                שמירה ב-Google
              </Button>
            </Tooltip>
            <Tooltip label="מוסיף את כל המסמכים שנשמרו במשתמש גוגל ומעדכן את ההגדרות.">
              <Button
                leftSection={<FontAwesome icon="rotate" />}
                loading={downloading}
                onClick={async () => {
                  setDownloading(true)
                  const successPromise = promiseToSuccessPromise(
                    getDoc(doc(firestore, `/users/${currentUser}`)).then(
                      (r) => {
                        const data = r.data()
                        if (data) {
                          setLocalStorage("Documents", {
                            ...getLocalStorage("Documents"),
                            ...data.documents,
                          })

                          const newSettings = { ...settings }
                          if (data.fullName) {
                            newSettings.fullName = data.fullName
                          }
                          if (data.sex) {
                            newSettings.sex = data.sex
                          }
                          if (data.signatureWidth) {
                            newSettings.signatureWidth = data.signatureWidth
                          }
                          setSettings(newSettings)
                        }
                      },
                    ),
                  )
                  showSuccessOrFailure(
                    successPromise,
                    "המסמכים מגוגל נמצאים כעת.",
                    "אנא נסו שנית.",
                  )
                  await successPromise
                  setDownloading(false)
                }}
              >
                הורדה מ-Google
              </Button>
            </Tooltip>
            <Button
              leftSection={<FontAwesome icon="right-from-bracket" />}
              onClick={() => signOut(auth)}
            >
              התנתקות
            </Button>
          </ButtonGroup>
        </>
      )}
      <h3 style={{ marginTop: 10, textAlign: "center" }}>כלים למפתחים</h3>
      <Button.Group orientation="vertical" my="xs">
        <Button
          leftSection={<FontAwesome icon="download" />}
          fullWidth
          onClick={() => {
            const a = window.document.createElement("a")
            a.style.display = "none"
            window.document.body.appendChild(a)
            const localStorageCopy = getLocalStorageCopy()
            a.href = `data:application/json;charset=utf-8,${encodeURIComponent(
              JSON.stringify(localStorageCopy, null, 4),
            )}`
            a.download = "localStorage.json"
            a.click()
            window.document.body.removeChild(a)
          }}
        >
          הורדת ה-Local Storage
        </Button>
        <Button
          leftSection={<FontAwesome icon="trash" />}
          fullWidth
          onClick={() =>
            modals.openConfirmModal({
              title: "אנא וודאו את פעולתכם",
              children: "האם אתם בטוחים שאתם רוצים למחוק הכל?!",
              confirmProps: { color: "red" },
              labels: { confirm: "אישור", cancel: "ביטול" },
              onConfirm: () => localStorage.clear(),
            })
          }
          color="red"
        >
          מחיקת ה-Local Storage
        </Button>
        <Dropzone
          accept={["application/json"]}
          style={{ textAlign: "center" }}
          multiple={false}
          onDrop={async (files) => {
            if (files.length === 0) {
              return
            }

            const text = await files[0].text()
            const data = JSON.parse(text)
            modals.openConfirmModal({
              title: "אנא וודאו את פעולתכם",
              children:
                "האם אתם בטוחים שאתם רוצים להעלות Local Storage? זה עלול למחוק לכם הכל!",
              confirmProps: { color: "red" },
              labels: { confirm: "אישור", cancel: "ביטול" },
              onConfirm: () => setLocalStorageCopy(data),
            })
          }}
          styles={{ root: { borderTopRightRadius: 0, borderTopLeftRadius: 0 } }}
        >
          <FontAwesome
            icon="upload"
            props={{ style: { marginInlineEnd: 5 } }}
          />{" "}
          העלאת ה-Local Storage
        </Dropzone>
      </Button.Group>
      <Dropzone
        accept={["application/json"]}
        onDrop={async (files) => {
          if (files.length === 0) {
            return
          }

          for (const file of files) {
            const content = await file.text()
            const format = JSON.parse(content)
            setLocalStorage("Custom Formats", {
              ...getLocalStorage("Custom Formats"),
              ...format,
            })
          }
        }}
        mb="xs"
        style={{ textAlign: "center" }}
      >
        <FontAwesome icon="upload" props={{ style: { marginInlineEnd: 10 } }} />
        גררו לכאן פורמט נוסף של מסמך כדי להוסיף אותו או לחצו כדי לבחור
      </Dropzone>
      <p style={{ opacity: 0.6, textAlign: "center", marginBottom: 10 }}>
        גרסת האתר: {new Date(version.date).toLocaleString("he-il")}
      </p>
    </Container>
  )
}

export default SettingsPage
