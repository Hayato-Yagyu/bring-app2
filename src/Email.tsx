import { FC } from 'react'
import { Button } from '@react-email/button'


type Props = {
  url: string
}

export const Email: FC<Props> = ({ url }) => {
  return (
    <Button href={url} data-testid="button">
      Click me
    </Button>
  )
}