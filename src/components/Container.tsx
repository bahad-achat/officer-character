const Container = ({
  children,
  withPadding,
  style,
}: {
  children?: React.ReactNode
  withPadding?: boolean
  style?: React.CSSProperties
}) => {
  return (
    <div
      style={{
        ...style,
        width: 600,
        maxWidth: "100%",
        paddingRight: 10,
        paddingLeft: 10,
        paddingBottom: withPadding ? 20 : undefined,
      }}
    >
      {children}
    </div>
  )
}

export default Container
