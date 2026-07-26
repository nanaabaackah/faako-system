#!/usr/bin/env python3
"""Generate the downloadable Nana Aba Ackah resume PDF."""

from pathlib import Path
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "public" / "documents" / "Nana Aba Ackah Resume.pdf"

INK = colors.HexColor("#191A17")
MUTED = colors.HexColor("#5D6255")
ACCENT = colors.HexColor("#6F765E")
ACCENT_SOFT = colors.HexColor("#E8E5D8")
PAPER = colors.HexColor("#F8F5EC")
WHITE = colors.white


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="ResumeName",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=27,
        textColor=INK,
        spaceAfter=3,
    )
)
styles.add(
    ParagraphStyle(
        name="ResumeTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=13,
        textColor=ACCENT,
        tracking=0.8,
        spaceAfter=7,
    )
)
styles.add(
    ParagraphStyle(
        name="ResumeContact",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.3,
        leading=11,
        textColor=MUTED,
    )
)
styles.add(
    ParagraphStyle(
        name="ResumeSection",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=INK,
        tracking=1.1,
        spaceBefore=9,
        spaceAfter=5,
        borderWidth=0,
        borderPadding=0,
    )
)
styles.add(
    ParagraphStyle(
        name="ResumeBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.6,
        leading=12,
        textColor=INK,
        spaceAfter=3,
    )
)
styles.add(
    ParagraphStyle(
        name="ResumeRole",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.3,
        leading=11.5,
        textColor=INK,
    )
)
styles.add(
    ParagraphStyle(
        name="ResumeCompany",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.4,
        leading=10.5,
        textColor=ACCENT,
    )
)
styles.add(
    ParagraphStyle(
        name="ResumeMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=MUTED,
        alignment=TA_RIGHT,
    )
)
styles.add(
    ParagraphStyle(
        name="ResumeBullet",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.25,
        leading=11,
        leftIndent=9,
        firstLineIndent=-7,
        bulletIndent=0,
        textColor=INK,
        spaceAfter=2,
    )
)
styles.add(
    ParagraphStyle(
        name="ResumeSmall",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.8,
        leading=10.2,
        textColor=INK,
    )
)
styles.add(
    ParagraphStyle(
        name="ResumeSkillLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.9,
        leading=10.2,
        textColor=ACCENT,
    )
)
styles.add(
    ParagraphStyle(
        name="ResumeProject",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.2,
        leading=11,
        textColor=INK,
        spaceAfter=2,
    )
)


def section(title):
    return [
        Spacer(1, 2),
        Table(
            [[Paragraph(title.upper(), styles["ResumeSection"])]],
            colWidths=[7.1 * inch],
            style=TableStyle(
                [
                    ("LINEBELOW", (0, 0), (-1, -1), 0.7, ACCENT),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            ),
        ),
        Spacer(1, 3),
    ]


def bullets(items):
    return [
        Paragraph(f"- {item}", styles["ResumeBullet"])
        for item in items
    ]


def experience_entry(role, company, meta, items):
    heading = Table(
        [
            [
                Paragraph(role, styles["ResumeRole"]),
                Paragraph(meta, styles["ResumeMeta"]),
            ],
            [
                Paragraph(company, styles["ResumeCompany"]),
                "",
            ],
        ],
        colWidths=[5.15 * inch, 1.95 * inch],
        style=TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("SPAN", (1, 0), (1, 1)),
            ]
        ),
    )
    return KeepTogether([heading, Spacer(1, 3), *bullets(items), Spacer(1, 5)])


def project_entry(name, stack, summary, highlights):
    return KeepTogether(
        [
            Paragraph(name, styles["ResumeProject"]),
            Paragraph(f"<b>Stack:</b> {stack}", styles["ResumeSmall"]),
            Paragraph(summary, styles["ResumeBody"]),
            *bullets(highlights),
            Spacer(1, 5),
        ]
    )


def page_decor(canvas, doc):
    canvas.saveState()
    width, height = letter
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(ACCENT)
    canvas.rect(0, height - 0.12 * inch, width, 0.12 * inch, fill=1, stroke=0)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.7 * inch, 0.38 * inch, "Nana Aba Ackah")
    canvas.drawRightString(width - 0.7 * inch, 0.38 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_resume(output_path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(output_path),
        pagesize=letter,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
        topMargin=0.55 * inch,
        bottomMargin=0.58 * inch,
        title="Nana Aba Ackah Resume",
        author="Nana Aba Ackah",
        subject="Business Analyst and Product Engineer resume",
        pageCompression=1,
    )
    frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    doc.addPageTemplates([PageTemplate(id="resume", frames=[frame], onPage=page_decor)])

    story = [
        Paragraph("NANA ABA ACKAH", styles["ResumeName"]),
        Paragraph("BUSINESS ANALYST | BUSINESS PROCESS AUTOMATION | PRODUCT ENGINEERING", styles["ResumeTitle"]),
        Paragraph(
            'Accra, Ghana&nbsp;&nbsp;|&nbsp;&nbsp;055-402-4694&nbsp;&nbsp;|&nbsp;&nbsp;'
            '<link href="mailto:nanaabaackah@gmail.com">nanaabaackah@gmail.com</link>&nbsp;&nbsp;|&nbsp;&nbsp;'
            '<link href="https://nanaabaackah.com">nanaabaackah.com</link>',
            styles["ResumeContact"],
        ),
        Paragraph(
            '<link href="https://www.linkedin.com/in/nana-aba-ackah/">linkedin.com/in/nana-aba-ackah</link>'
            '&nbsp;&nbsp;|&nbsp;&nbsp;'
            '<link href="https://github.com/nanaabaackah/">github.com/nanaabaackah</link>',
            styles["ResumeContact"],
        ),
        *section("Professional Summary"),
        Paragraph(
            "Business Analyst and Product Engineer with 3+ years of experience translating operational needs into "
            "clear requirements, automated workflows, ERP capabilities, and reliable digital products. Current work "
            "focuses on business-process automation at MTN Ghana. Background spans process analysis, stakeholder "
            "alignment, UAT, change enablement, Odoo delivery, full-stack product development, reporting, and "
            "role-aware operational systems.",
            styles["ResumeBody"],
        ),
        *section("Core Skills"),
        Table(
            [
                [
                    Paragraph("Business analysis", styles["ResumeSkillLabel"]),
                    Paragraph(
                        "Process analysis, requirements gathering, process mapping, acceptance criteria, stakeholder alignment, UAT coordination, change enablement",
                        styles["ResumeSmall"],
                    ),
                ],
                [
                    Paragraph("Automation + ERP", styles["ResumeSkillLabel"]),
                    Paragraph(
                        "Business-process automation, workflow design, Odoo.sh, Odoo Studio, Python ORM, QWeb/XML, operational reporting",
                        styles["ResumeSmall"],
                    ),
                ],
                [
                    Paragraph("Product engineering", styles["ResumeSkillLabel"]),
                    Paragraph(
                        "React, Astro, Vue 3, JavaScript, Node.js, Express, REST APIs, PostgreSQL, Prisma, accessible frontend systems",
                        styles["ResumeSmall"],
                    ),
                ],
                [
                    Paragraph("Delivery + quality", styles["ResumeSkillLabel"]),
                    Paragraph(
                        "Product discovery, documentation, rollout planning, analytics, Playwright, API testing, Git, CI/CD, security and accessibility checks",
                        styles["ResumeSmall"],
                    ),
                ],
            ],
            colWidths=[1.28 * inch, 5.82 * inch],
            style=TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BACKGROUND", (0, 0), (0, -1), ACCENT_SOFT),
                    ("BOX", (0, 0), (-1, -1), 0.35, colors.HexColor("#C8C6BA")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D8D5C9")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            ),
        ),
        *section("Experience"),
        experience_entry(
            "Business Analyst",
            "MTN Ghana",
            "Accra, Ghana | 2026 - Present",
            [
                "Analyze current-state business processes and identify practical opportunities for automation.",
                "Translate operational needs into clear requirements, workflow definitions, and implementation priorities.",
                "Align business and technical stakeholders around process changes, expected system behavior, and acceptance criteria.",
                "Support validation and adoption so automated workflows remain usable, traceable, and sustainable.",
            ],
        ),
        experience_entry(
            "IT Technician and Front-End Developer",
            "IBW Surveyors Ltd.",
            "Remote | Oct 2024 - Jul 2025",
            [
                "Rebuilt internal portal experiences with responsive, accessibility-aware UI patterns and clearer navigation.",
                "Delivered reporting workflows using BigQuery, Looker Studio, and SQL Server to improve operational visibility.",
                "Automated onboarding and document-routing workflows and supported security coordination with MSP partners.",
            ],
        ),
        experience_entry(
            "Digital Experience Lead and ERP Systems Manager",
            "IN Engineering + Surveying Ltd.",
            "Hybrid | Sep 2022 - Oct 2024",
            [
                "Led Odoo ERP rollout and customization across five departments spanning CRM, project delivery, operations, and finance.",
                "Built workflow automation with Python, JavaScript, QWeb, XML, and Odoo Studio to reduce repeated manual work.",
                "Converted business requirements into maintainable workflows, reporting structures, training, documentation, and UAT plans.",
                "Improved website, intranet, ERP, analytics, and client workflow touchpoints through UX and content iteration.",
            ],
        ),
        PageBreak(),
        *section("Selected Systems"),
        project_entry(
            "REEBS Party Themes Storefront and Operations ERP",
            "React, Vite, Express, Prisma, PostgreSQL",
            "A live customer storefront paired with a role-aware operations portal and backend.",
            [
                "Connects CRM intake, POS, orders, rental bookings, inventory, finance, fulfillment, maintenance, workforce workflows, and reports.",
                "Surfaces time-window KPIs, revenue mix and trends, assigned work, stock risk, and booking conflicts for operational decisions.",
            ],
        ),
        project_entry(
            "Development Operations System (Dev ERP)",
            "React, Express, Prisma, PostgreSQL, Playwright",
            "A live internal ERP for project delivery and cross-application operations.",
            [
                "Covers projects and tasks, proposals, form intake, rent, accounting, invoicing, appointments, reporting, users, audit activity, and system health.",
                "Uses cookie sessions, CSRF protection, capability checks, organization scoping, modular APIs, scheduled jobs, and external integrations.",
            ],
        ),
        project_entry(
            "Odoo ERP Customization",
            "Odoo.sh, Python ORM, JavaScript, QWeb/XML, Odoo Studio",
            "Cross-department ERP delivery focused on process automation, adoption, and reporting consistency.",
            [
                "Automated CRM-to-project-to-accounting transitions, project identifiers, notifications, and invoice-status follow-up.",
                "Paired technical changes with staged QA, documentation, training, and office-hours enablement.",
            ],
        ),
        project_entry(
            "Astro Portfolio and Content Platform",
            "Astro, React, structured data, automated quality checks",
            "A static-first public portfolio built for search visibility, accessibility, performance, and maintainable project storytelling.",
            [
                "Generates crawlable project and article routes with canonical metadata, schema markup, sitemap output, and optimized media.",
                "Automated tests cover SEO output, local links, assets, duplicate IDs, security headers, and delivery budgets.",
            ],
        ),
        *section("Education"),
        Paragraph("<b>Trent University</b>", styles["ResumeRole"]),
        Paragraph(
            "Bachelor of Arts Honours (BAH), Business and Computer Science",
            styles["ResumeBody"],
        ),
        *section("Selected Certifications"),
        Table(
            [
                [
                    Paragraph("- Web Development with HTML, CSS, JavaScript", styles["ResumeSmall"]),
                    Paragraph("- Developing Front-End Apps with React", styles["ResumeSmall"]),
                ],
                [
                    Paragraph("- Developing Back-End Apps with Node.js and Express", styles["ResumeSmall"]),
                    Paragraph("- Python for Data Science, AI and Development", styles["ResumeSmall"]),
                ],
                [
                    Paragraph("- Database Management Essentials", styles["ResumeSmall"]),
                    Paragraph("- Developing AI Applications with Python and Flask", styles["ResumeSmall"]),
                ],
            ],
            colWidths=[3.55 * inch, 3.55 * inch],
            style=TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ]
            ),
        ),
    ]

    doc.build(story)


if __name__ == "__main__":
    destination = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else DEFAULT_OUTPUT
    build_resume(destination)
    print(destination)
