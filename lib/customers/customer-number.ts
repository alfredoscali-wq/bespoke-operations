const CUSTOMER_NUMBER_PREFIX = "CLI-"

type CustomerNumberSource = {
  customerNumber: string
}

export function parseCustomerNumberCounter(
  customerNumber: string | null | undefined
): number {
  if (!customerNumber) return 0

  const match = customerNumber.match(/^CLI-(\d+)$/)
  if (!match) return 0

  return Number.parseInt(match[1], 10)
}

export function formatCustomerNumber(counter: number): string {
  return `${CUSTOMER_NUMBER_PREFIX}${String(counter).padStart(6, "0")}`
}

export function generateCustomerNumber(
  existingCustomers: CustomerNumberSource[] = []
): string {
  let counter = 0

  for (const customer of existingCustomers) {
    counter = Math.max(
      counter,
      parseCustomerNumberCounter(customer.customerNumber)
    )
  }

  return formatCustomerNumber(counter + 1)
}
