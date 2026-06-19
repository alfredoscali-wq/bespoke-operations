const CUSTOMER_NUMBER_PREFIX = "CLI-"

type CustomerNumberSource = {
  customerNumber: string
}

export function generateCustomerNumber(
  existingCustomers: CustomerNumberSource[] = []
): string {
  let counter = 0

  for (const customer of existingCustomers) {
    const match = customer.customerNumber.match(/^CLI-(\d+)$/)
    if (!match) continue
    counter = Math.max(counter, Number.parseInt(match[1], 10))
  }

  return `${CUSTOMER_NUMBER_PREFIX}${String(counter + 1).padStart(6, "0")}`
}
