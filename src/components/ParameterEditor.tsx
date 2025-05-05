import {
  ActionIcon,
  Alert,
  Button,
  Fieldset,
  Textarea,
  Tooltip,
} from "@mantine/core"
import { TemplateParameter } from "../typst"
import FontAwesome from "./FontAwesome"
import TypstEditor from "./TypstEditor"
import { useEffect, useState } from "react"
import { canonicalize } from "../errorChecking"

const ParameterEditor = ({
  p,
  isTutorial,
  value,
  onChange,
}: {
  p: TemplateParameter
  isTutorial: boolean
  value: any
  onChange: (v: any) => void
}) => {
  const [values, setValues] = useState<any[]>(
    value ? JSON.parse(JSON.stringify(value)) : [{}],
  )

  useEffect(() => {
    if (p.variadic && JSON.stringify(value) !== JSON.stringify(values)) {
      onChange(values)
    }
  }, [values])

  useEffect(() => {
    setValues(value ? JSON.parse(JSON.stringify(value)) : [{}])
  }, [JSON.stringify(value)])

  if (p.variadic) {
    return (
      <>
        {values.map((v, index) => (
          <Fieldset
            mt="xs"
            legend={
              <>
                {p.label} {index + 1}
                <Tooltip label="מחיקה">
                  <ActionIcon
                    mr={5}
                    color="red"
                    onClick={() =>
                      setValues((values) =>
                        values.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <FontAwesome icon="trash" />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="שכפול">
                  <ActionIcon
                    mr={5}
                    onClick={() =>
                      setValues((values) => [
                        ...values.slice(0, index + 1),
                        { ...values[index] },
                        ...values.slice(index + 1),
                      ])
                    }
                  >
                    <FontAwesome icon="clone" />
                  </ActionIcon>
                </Tooltip>
              </>
            }
            key={index}
            mb={5}
          >
            {p.children!.map((child, childIndex) => (
              <ParameterEditor
                key={childIndex}
                p={child}
                isTutorial={isTutorial}
                value={v[child.name]}
                onChange={(newValue) => {
                  v[child.name] = newValue
                  setValues([...values])
                }}
              />
            ))}
          </Fieldset>
        ))}
        <Button
          fullWidth
          leftSection={<FontAwesome icon="plus" />}
          onClick={() => setValues((values) => [...values, {}])}
        >
          הוספת {p.label}
        </Button>
      </>
    )
  }

  if (p.isTypst) {
    return (
      <>
        <p style={{ marginBottom: 5, marginTop: 10 }}>{p.label}</p>
        <TypstEditor
          value={value}
          defaultContent={p.defaultContent}
          onChange={onChange}
          placeholder={p.placeholder}
          errorChecker={p.errorChecker}
          typstChecker={p.typstChecker}
        />
        {isTutorial && p.tutorial !== undefined && (
          <Alert
            color="yellow"
            icon={<FontAwesome icon="lightbulb" />}
            mt={5}
            mb="md"
          >
            {p.tutorial}
          </Alert>
        )}
      </>
    )
  }

  return (
    <>
      <Textarea
        mb={isTutorial && p.tutorial !== undefined ? undefined : "xs"}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            const v = e.currentTarget.value + "\t"
            onChange(v)
            e.preventDefault()
          }
        }}
        leftSection={p.icon ? <FontAwesome icon={p.icon} /> : undefined}
        label={p.label}
        autosize
        minRows={p.lines ?? 1}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={p.placeholder}
        error={
          value && isTutorial
            ? p.errorChecker?.(canonicalize(value))
            : undefined
        }
      />
      {isTutorial && p.tutorial !== undefined && (
        <Alert
          color="yellow"
          icon={<FontAwesome icon="lightbulb" />}
          mt={5}
          mb="md"
        >
          {p.tutorial}
        </Alert>
      )}
    </>
  )
}

export default ParameterEditor
