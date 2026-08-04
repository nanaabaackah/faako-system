# Application analytics use-case matrix

Legend: **Platform** = shared Python is justified; **Local** = SQL/frontend/BI is
simpler; **Later** = requires data/definition/governance work; **N/A** = no current case.

| Application | Operational | Sales/commercial | Inventory | Finance | Booking/events | Impact | Product usage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dev ERP | Platform pilot: task cycle/overdue/workload | Later: quotation conversion | N/A | Later: ageing/cash-flow | Local for simple booking counts | N/A | Later: module adoption |
| Faako ERP | Later after operational adoption | Later | Later | Later after finance definitions | Later | N/A | Later |
| Faako Website/platform | N/A | Local: consent-aware acquisition/enquiries | N/A | N/A | N/A | N/A | Local: web analytics |
| REEBS Portal/Website | Local plus platform trends | Platform-compatible dashboard | Platform pilot: days-cover/risk | Later | Platform-compatible demand | N/A | Later |
| Stroane public/admin | Later | Later: enquiry conversion | Later: stock movement/slow stock | Local initially | N/A | N/A | Later |
| TTNGH | Later | N/A | N/A | Later: donation trends | Later: event participation | Later: reach/engagement | Local initially |
| Hotel/event solutions | Later | Later | N/A | Later: profitability | Later: utilisation/lead time | N/A | Later |
| Automation reporting | Platform: cycle-time/time-saved comparison | N/A | N/A | Later: benefit/value | N/A | Platform-compatible outcome reports | Later |
| Future tenant apps | Review required | Review required | Review required | Review required | Review required | Review required | Review required |

No `Later` entry authorises data collection. It identifies a question that must pass
privacy, source, metric and value review before implementation.

