import {
  ActionIcon,
  Alert,
  Autocomplete,
  Button,
  Chip,
  TextInput,
  Tooltip,
} from "@mantine/core"
import { modals } from "@mantine/modals"
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import FontAwesome from "../components/FontAwesome"
import { getLocalStorage, useLocalStorage } from "../hooks"
import { OCDocuments } from "../models"
import Container from "../components/Container"
import { Dropzone } from "@mantine/dropzone"
import { TEMPLATE_GROUPS, TemplateInfo, TEMPLATES } from "../typst"

export const getTemplates = () => {
  return {
    ...TEMPLATES,
    ...getLocalStorage<Record<string, TemplateInfo>>("Custom Formats"),
  }
}

export const getNameToTemplateMap = (templates: {
  [key: string]: TemplateInfo
}) => {
  const result: Record<string, string> = {}
  for (const key in templates) {
    result[templates[key].name] = key
  }
  return result
}

export const getTemplatesByGroup = () => {
  const templatesByGroup: Record<string, string[]> = {}
  const templates = getTemplates()
  for (const template in templates) {
    if (!templatesByGroup[templates[template].group]) {
      templatesByGroup[templates[template].group] = []
    }
    templatesByGroup[templates[template].group].push(template)
  }
  return templatesByGroup
}

const CreateDocumentModal = ({
  setDocuments,
  documents,
  name: initialName,
  kind: initialKind,
}: {
  documents: OCDocuments
  setDocuments: (v: OCDocuments) => void
  name?: string
  kind?: string
}) => {
  const [kind, setKind] = useState(initialKind ?? "")
  const [name, setName] = useState(initialName ?? "")
  const navigate = useNavigate()

  const templates = getTemplates()
  const templatesByGroup = getTemplatesByGroup()
  const nameToTemplateMap = getNameToTemplateMap(templates)

  const submit = () => {
    setDocuments({
      ...documents,
      [name]: {
        type: nameToTemplateMap[kind],
        modificationDate: new Date().toISOString(),
      },
    })
    modals.closeAll()
    navigate(`/documents/${name}`)
  }

  let error: string | undefined

  if (name === "") {
    error = "יש לבחור שם למסמך!"
  } else if (documents[name] !== undefined) {
    error = "מסמך עם שם כזה כבר קיים!"
  } else if (nameToTemplateMap[kind] === undefined) {
    error = "יש לבחור סוג למסמך!"
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
        label="שם מסמך"
        leftSection={<FontAwesome icon="file-lines" />}
      />
      <Autocomplete
        mt="xs"
        leftSection={<FontAwesome icon="file-lines" />}
        value={kind}
        onChange={(v) => setKind(v)}
        data={TEMPLATE_GROUPS.map((group) => ({
          group,
          items: templatesByGroup[group]
            .sort((a, b) => templates[a].name.localeCompare(templates[b].name))
            .map((item) => templates[item].name),
        }))}
        label="סוג"
      />
      <Button
        fullWidth
        mt="xs"
        leftSection={<FontAwesome icon="plus" />}
        onClick={submit}
        disabled={error !== undefined}
      >
        יצירת המסמך
      </Button>
      {error && (
        <Alert color="yellow" mt="xs" icon={<FontAwesome icon="exclamation" />}>
          {error}
        </Alert>
      )}
    </>
  )
}

const DocumentsPage = () => {
  const [documents, setDocuments] = useLocalStorage<OCDocuments>({
    key: "Documents",
    defaultValue: {},
  })
  const navigate = useNavigate()
  const location = useLocation()

  const createDocument = (kind?: string, name?: string) =>
    modals.open({
      title: "יצירת מסמך חדש",
      children: (
        <CreateDocumentModal
          documents={documents}
          setDocuments={setDocuments}
          kind={kind}
          name={name}
        />
      ),
    })

  useEffect(() => {
    if (location.state?.create) {
      createDocument(location.state.create.kind, location.state.create.name)
      navigate(".", { state: {} })
    }
  }, [location])

  const templates = getTemplates()

  return (
    <Container style={{ textAlign: "center" }}>
      <h1
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        מסמכים
        <Tooltip label="מסמך חדש">
          <ActionIcon mr="xs" onClick={() => createDocument()} color="green">
            <FontAwesome icon="plus" />
          </ActionIcon>
        </Tooltip>
      </h1>
      <div style={{ overflow: "auto" }}>
        {Object.keys(documents)
          .sort(
            (a, b) =>
              new Date(documents[b].modificationDate).getTime() -
              new Date(documents[a].modificationDate).getTime(),
          )
          .map((documentName, index) => (
            <Chip
              display="inline-block"
              size="lg"
              ml={10}
              mb={10}
              key={index}
              icon={<FontAwesome icon="file-lines" />}
              checked
              onClick={() =>
                navigate(`/documents/${encodeURIComponent(documentName)}`)
              }
              color={
                documents[documentName].type
                  ? templates[documents[documentName].type]?.color
                  : undefined
              }
              styles={{ label: { lineHeight: "12px" } }}
            >
              <span style={{ fontSize: 16 }}>{documentName}</span>
              <br />
              <span style={{ fontSize: 10, opacity: 0.6 }}>
                {templates[documents[documentName].type]?.name}
              </span>
            </Chip>
          ))}
      </div>
      <Dropzone
        accept={["application/json"]}
        onDrop={async (files) => {
          for (const file of files) {
            const content = await file.text()
            const document = JSON.parse(content)
            setDocuments((d) => ({
              ...d,
              [file.name.split(".").slice(0, -1).join(".")]: document,
            }))
          }
        }}
        mb="xs"
        style={{ textAlign: "center" }}
      >
        <FontAwesome icon="upload" props={{ style: { marginInlineEnd: 10 } }} />
        גררו לכאן גיבוי של מסמך כדי להוסיף אותו או לחצו כדי לבחור
      </Dropzone>
    </Container>
  )
}

export default DocumentsPage
