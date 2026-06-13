import type { Crew } from "@/lib/types/crews"
import { MemberStatusBadge } from "@/components/cuadrillas/crew-badges"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type CrewMembersTabProps = {
  crew: Crew
}

export function CrewMembersTab({ crew }: CrewMembersTabProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Integrantes</CardTitle>
        <CardDescription>
          Personal asignado a {crew.name} y su disponibilidad operativa
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden overflow-hidden rounded-xl border lg:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nombre</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crew.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.position}
                  </TableCell>
                  <TableCell>
                    <MemberStatusBadge status={member.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3 lg:hidden">
          {crew.members.map((member) => (
            <div
              key={member.id}
              className="flex items-start justify-between gap-3 rounded-lg border bg-muted/20 p-3"
            >
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-sm text-muted-foreground">
                  {member.position}
                </p>
              </div>
              <MemberStatusBadge status={member.status} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
