import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Checkbox,
  Flex,
  Box,
  Loader,
  Menu,
  Select,
  Switch,
  TagsInput,
  TextInput,
  Tooltip,
} from "@mantine/core"
import { DatePickerInput } from "@mantine/dates"
import { modals } from "@mantine/modals"
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import Container from "../components/Container"
import FontAwesome from "../components/FontAwesome"
import { useLocalStorage } from "../hooks"
import { OCDocument, OCDocuments } from "../models"
import { arraysEqual, downloadBlob, downloadJson } from "../utilities"
import { Settings } from "./SettingsPage"
import { compileDocument, TEMPLATE_GROUPS } from "../typst"
import { useDebouncedCallback, useOs } from "@mantine/hooks"
import ParameterEditor from "../components/ParameterEditor"
import { getTemplates, getTemplatesByGroup } from "./DocumentsPage"
import SettingsEditor from "../components/SettingsEditor"
import { showFailureMessage } from "../ui-utilities"

const PREVIEW_DEBOUNCE = 2000

const getPeople = (documents: OCDocuments) => {
  const list = new Set<string>()
  for (const document of Object.values(documents)) {
    // Backwards compatibility with string da's.
    if (typeof document?.da === "string") {
      document.da = (document.da as string).split(",").map((x) => x.trim())
    }

    for (const to of document.to ?? []) {
      list.add(to)
    }
    for (const da of document.da ?? []) {
      list.add(da)
    }
  }

  return [...list].sort()
}

const findPersonErrors = (person: string | undefined) => {
  if (!person) {
    return
  }
  person = person.replace(/״/g, '"')

  if (person.includes("/")) {
    return "יש לציין הייררכייה באמצעות מקפים ולא /, למשל: בה״ד 1 - מגמת נחשון ולא: בה״ד 1/מגמת נחשון"
  }

  if (
    person.includes('סג"ן') ||
    person.includes('סג"נ') ||
    person.includes('סר"ן') ||
    person.includes('סר"נ')
  ) {
    return "יש לכתוב סגן/סרן ולא סג״ן/סר״ן/סג״נ/סר״נ"
  }

  if (person.includes('אל"מ')) {
    return "יש לכתוב אל״ם ולא אל״מ"
  }

  if (person.includes('סג"מ')) {
    return "יש לכתוב סג״ם ולא סג״מ"
  }
}

const getRank = (person: string) => {
  return person.split("-").at(-1)!.trim().split(" ")[0].replace("״", '"')
}

const rankLists = [
  [
    "שוחר",
    "שוחרת",
    "צוער",
    "צוערת",
    "טוראי",
    'רב"ט',
    "סמל",
    'רס"ל',
    'רס"ר',
    "רס״ם",
    'רס"ב',
    'רנ"ם',
    'רנ"ג',
  ],
  [
    "שוחר",
    "שוחרת",
    "צוער",
    "צוערת",
    "טוראי",
    'רב"ט',
    "סמל",
    'סג"ם',
    'קמ"א',
    "סגן",
    'קא"ב',
    "סרן",
    'רס"ן',
    'סא"ל',
    'אל"ם',
    'תא"ל',
    "אלוף",
    'רא"ל',
  ],
]

/** Checks that the array is sorted by rank and valid */
const findPersonListErrors = (people: string[]): string | undefined => {
  for (const person of people) {
    const error = findPersonErrors(person)
    if (error) {
      return error
    }
  }

  const ranks = people.map(getRank)
  for (const rankList of rankLists) {
    const indices = ranks
      .map((r) => rankList.indexOf(r))
      .filter((x) => x !== -1)
    if (
      !arraysEqual(
        [...indices].sort((a, b) => b - a),
        indices,
      )
    ) {
      return "הרשימה צריכה להיות ממוינת לפי דרגה!"
    }
  }
  return
}

const RenameDocumentModal = ({ documentName }: { documentName: string }) => {
  const [name, setName] = useState(documentName)
  const [documents, setDocuments] = useLocalStorage<OCDocuments>({
    key: "Documents",
    defaultValue: {},
  })
  const navigate = useNavigate()

  const submit = () => {
    const newDocuments = {
      ...documents,
      [name]: {
        ...documents[documentName],
        modificationDate: new Date().toString(),
      },
    }
    delete newDocuments[documentName]
    setDocuments(newDocuments)
    navigate(`/documents/${name}`)
    modals.closeAll()
  }

  return (
    <>
      <TextInput
        data-autofocus
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            submit()
          }
        }}
        label="שם"
        leftSection={<FontAwesome icon="file-lines" />}
      />
      <Button
        fullWidth
        mt="xs"
        leftSection={<FontAwesome icon="floppy-disk" />}
        onClick={submit}
        disabled={name === "" || documents[name] !== undefined}
      >
        שמירה
      </Button>
    </>
  )
}

const DocumentPage = () => {
  const [initializingTypst] = useLocalStorage<boolean>({
    key: "Initializing Typst",
    defaultValue: true,
  })
  const [compiling, setCompiling] = useState(false)
  const { document: documentName } = useParams()
  const [documents, setDocuments] = useLocalStorage<OCDocuments>({
    key: "Documents",
    defaultValue: {},
  })
  const navigate = useNavigate()
  const [settings] = useLocalStorage<Settings>({
    key: "Settings",
    defaultValue: {},
  })
  const [isTutorial] = useLocalStorage<boolean>({
    key: "Is Tutorial",
    defaultValue: true,
  })
  const [showPreview] = useLocalStorage<boolean>({
    key: "Show Preview",
    defaultValue: true,
  })
  const [previewSrc, setPreviewSrc] = useState("")
  const os = useOs()

  const document = documents[documentName!]

  useEffect(() => {
    if (!document) {
      showFailureMessage(`המסמך "${documentName}" לא קיים!`)
      navigate("/documents")
    }
  }, [document])

  if (!document) {
    return <></>
  }

  // Backwards compatibility with string da's.
  if (typeof document.da === "string") {
    document.da = (document.da as string).split(",").map((x) => x.trim())
  }

  if (!documentName || !document) {
    useEffect(() => navigate("/documents"), [])
    return <></>
  }

  const people = getPeople(documents).filter(
    (x) => !(document.da ?? []).concat(document.to ?? []).includes(x),
  )

  const updateDocument = (newDocument: OCDocument) => {
    setDocuments({
      ...documents,
      [documentName!]: {
        ...newDocument,
        modificationDate: new Date().toString(),
      },
    })
  }

  const compile = async () => {
    setCompiling(true)
    try {
      const result = await compileDocument(document)
      if (result) {
        const blob = new Blob([result], {
          type: "application/pdf",
        })
        downloadBlob(
          blob,
          documentName +
            (settings.fullName ? " - " + settings.fullName : "") +
            ".pdf",
        )
      }
    } finally {
      setCompiling(false)
    }
  }

  const debouncedPreview = useDebouncedCallback(() => {
    if (!window.typstCompiler) {
      setTimeout(debouncedPreview, 1000)
      return
    }

    const oldSrc = previewSrc.toString()
    compileDocument(document).then((result) => {
      if (result) {
        const blob = new Blob([result], {
          type: "application/pdf",
        })
        setPreviewSrc(URL.createObjectURL(blob))
      }
    })
    if (oldSrc !== "") {
      URL.revokeObjectURL(oldSrc)
    }
  }, PREVIEW_DEBOUNCE)

  useEffect(() => {
    if (showPreview) {
      setPreviewSrc("")
      debouncedPreview()
    }
  }, [document])

  const download = () => downloadJson(document, documentName + ".json")

  const rename = () => {
    modals.open({
      title: "שינוי שם המסמך",
      children: <RenameDocumentModal documentName={documentName} />,
    })
  }

  const duplicate = () => {
    modals.openConfirmModal({
      title: "אנא וודאו את פעולתכם",
      children: `האם אתם בטוחים שברצונכם לשכפל את "${documentName}"?`,
      labels: { confirm: "אישור", cancel: "ביטול" },
      onConfirm: () => {
        documents["עותק של " + documentName] = { ...documents[documentName] }
        setDocuments(documents)
        navigate(`/documents/עותק של ${documentName}`)
      },
    })
  }

  const deleteDocument = () =>
    modals.openConfirmModal({
      title: "אנא וודאו את פעולתכם",
      children: `האם אתם בטוחים שברצונכם למחוק את "${documentName}"?`,
      labels: { confirm: "אישור", cancel: "ביטול" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        navigate("/documents")
        delete documents[documentName!]
        setDocuments(documents)
      },
    })

  const templates = getTemplates()
  const templatesByGroup = getTemplatesByGroup()

  return (
    <>
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 10,
        }}
      >
        {documentName}
        <ActionIcon.Group mr="xs">
          <Tooltip label="ייצוא PDF (לא ניתן לערוך אותו בצורה נוחה לאחר הורדה, כמובן אפשר להמשיך לערוך באתר)">
            <ActionIcon
              size="lg"
              color="green"
              variant="light"
              onClick={compile}
              loading={initializingTypst || compiling}
            >
              <FontAwesome icon="download" />
            </ActionIcon>
          </Tooltip>
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Tooltip label="פעולות">
                <ActionIcon size="lg" variant="light">
                  <FontAwesome icon="ellipsis" />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>

            <Menu.Dropdown>
              {templates[document.type].buttons?.map((button, buttonIndex) => (
                <Menu.Item
                  key={buttonIndex}
                  onClick={() =>
                    button.onClick(
                      JSON.parse(JSON.stringify(document.parameters ?? {})),
                    )
                  }
                  leftSection={<FontAwesome icon={button.icon} />}
                >
                  {button.label}
                </Menu.Item>
              ))}
              <Menu.Item
                leftSection={<FontAwesome icon="file-lines" />}
                onClick={download}
              >
                הורדת גיבוי
              </Menu.Item>
              <Menu.Item
                leftSection={<FontAwesome icon="pen" />}
                onClick={rename}
              >
                שינוי שם
              </Menu.Item>
              <Menu.Item
                leftSection={<FontAwesome icon="copy" />}
                onClick={duplicate}
              >
                שכפול
              </Menu.Item>
              <Menu.Item
                leftSection={<FontAwesome icon="trash" />}
                color="red"
                onClick={deleteDocument}
              >
                מחיקה
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </ActionIcon.Group>
      </h2>
      {document.type !== undefined && (
        <Flex
          direction={{ base: "column", lg: "row" }}
          align={{ base: "center", lg: "flex-start" }}
          justify={{ base: "flex-start", lg: "center" }}
          gap="md"
          w="100%"
          px={{ base: "sm", lg: 40 }}
          style={{ flexGrow: 1, overflow: "auto", boxSizing: "border-box" }}
        >
          <Container withPadding>
            <Select
            leftSection={<FontAwesome icon="file-lines" />}
            value={document.type}
            onChange={(v) => updateDocument({ ...document, type: v ?? "work" })}
            data={TEMPLATE_GROUPS.map((group) => ({
              group,
              items: templatesByGroup[group]
                .sort((a, b) =>
                  templates[a].name.localeCompare(templates[b].name),
                )
                .map((item) => ({ label: templates[item].name, value: item })),
            }))}
            label="סוג"
          />
          <TextInput
            mt="xs"
            label="הנדון"
            leftSection={<FontAwesome icon="pencil" />}
            value={document?.title ?? ""}
            onChange={(e) => {
              const title = e.currentTarget.value
              updateDocument({ ...document, title })
            }}
            error={document.title?.endsWith(".") ? "אין בסוף הנדון נקודה" : ""}
          />
          <Select
            mt="xs"
            label="רמת סיווג"
            leftSection={<FontAwesome icon="user-secret" />}
            value={document.secretness ?? 'בלמ"ס'}
            onChange={(secretness) => {
              updateDocument({ ...document, secretness: secretness ?? 'בלמ"ס' })
            }}
            data={['בלמ"ס', "שמור"]}
          />
          <Flex mt="xs" align="end" gap="sm">
            <DatePickerInput
              style={{ flex: 1 }}
              value={document.date ? new Date(document.date) : null}
              onChange={(date) =>
                updateDocument({ ...document, date: date?.toISOString() })
              }
              label="תאריך"
              leftSection={<FontAwesome icon="calendar" />}
              highlightToday
              clearable
            />
            <Flex h={36} align="center">
              <Checkbox
                label="אחרי שקיעה"
                checked={document.afterSunset ?? false}
                onChange={(e) =>
                  updateDocument({ ...document, afterSunset: e.currentTarget.checked })
                }
              />
            </Flex>
          </Flex>
          <Tooltip label="נמענים לפעולה">
            <TagsInput
              mt="xs"
              label="אל"
              placeholder="בה״ד 1 - מגמת נחשון - גדוד ארז - מ״פ גולן - סרן ישראל ישראלי"
              leftSection={<FontAwesome icon="at" />}
              value={document?.to ?? []}
              onChange={(to) => updateDocument({ ...document, to })}
              data={people}
              error={findPersonListErrors(document.to ?? [])}
            />
          </Tooltip>
          <Tooltip label="נמענים לידיעה">
            <TagsInput
              my="xs"
              label="דע (לחצו על אנטר כדי להוסיף)"
              placeholder="בה״ד 1 - מגמת נחשון - גדוד ארז - מפקדת צוות 16 - סגן ישראלה ישראלית"
              leftSection={<FontAwesome icon="at" />}
              value={document?.da ?? []}
              onChange={(da) => updateDocument({ ...document, da })}
              data={people}
              error={findPersonListErrors(document.da ?? [])}
            />
          </Tooltip>
          <Switch
            mt="xs"
            label="מיועד לאזרחים?"
            checked={document.forCivillians ?? false}
            onChange={(e) =>
              updateDocument({
                ...document,
                forCivillians: e.currentTarget.checked,
              })
            }
          />
          {templates[document.type].parameters.map((p, pIndex) => (
            <ParameterEditor
              key={pIndex}
              p={p}
              isTutorial={isTutorial}
              value={(document?.parameters ?? {})[p.name] ?? ""}
              onChange={(value) => {
                updateDocument({
                  ...document,
                  parameters: {
                    ...document.parameters,
                    [p.name]: value,
                  },
                })
              }}
            />
          ))}
          {!settings.fullName && (
            <Alert
              mt="xs"
              icon={<FontAwesome icon="exclamation" />}
              color="red"
            >
              יש למלא שם מלא{" "}
              <Anchor
                style={{ fontSize: "inherit" }}
                href="/settings"
                onClick={(e) => {
                  e.preventDefault()
                  navigate("/settings")
                }}
              >
                בהגדרות
              </Anchor>{" "}
              כדי שיופיע במסמכים!
            </Alert>
          )}
          {settings.signature === undefined && (
            <Alert
              mt="xs"
              icon={<FontAwesome icon="exclamation" />}
              color="red"
            >
              יש להעלות חתימה{" "}
              <Anchor
                style={{ fontSize: "inherit" }}
                href="/settings"
                onClick={(e) => {
                  e.preventDefault()
                  navigate("/settings")
                }}
              >
                בהגדרות
              </Anchor>{" "}
              כדי שתופיע במסמכים!
            </Alert>
          )}
          <Switch
            mt="xs"
            label="עריכת הגדרות מיוחדות (שינויים מההגדרות הכלליות למסמך הספציפי)"
            checked={document.overrideSettings ?? false}
            onChange={(e) =>
              updateDocument({
                ...document,
                overrideSettings: e.currentTarget.checked,
              })
            }
          />
          {document.overrideSettings && (
            <SettingsEditor
              settings={document.settings ?? {}}
              setSettings={(settings) =>
                updateDocument({ ...document, settings })
              }
            />
          )}
          </Container>
          {showPreview && (
            <Box
              flex={1}
              w={{ base: "100%", lg: "auto" }}
              style={{
                maxWidth: 1200,
                paddingRight: 40,
                paddingLeft: 40,
                paddingBottom: 20,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <h2 style={{ textAlign: "center" }}>תצוגה מקדימה</h2>
                {(os === "ios" || os === "undetermined") && (
                  <p style={{ textAlign: "center" }}>
                    התצוגה המקדימה באייפונים ואייפדים מציגה רק את העמוד הראשון.
                  </p>
                )}
                {previewSrc === "" ? (
                  <Loader mt="xs" />
                ) : (
                  <iframe
                    src={previewSrc}
                    style={{
                      marginTop: 10,
                      width: "100%",
                      aspectRatio: "1 / 1.414",
                      border: "none",
                      borderRadius: 10,
                    }}
                  />
                )}
              </div>
            </Box>
          )}
        </Flex>
      )}
    </>
  )
}

export default DocumentPage
