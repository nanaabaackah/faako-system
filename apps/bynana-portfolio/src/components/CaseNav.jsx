import React from 'react';
import { Link } from 'react-router-dom';
import { HiArrowLeft, HiArrowRight } from 'react-icons/hi2';

const projectNavItems = [
    {
        slug: 'reconstruction',
        title: 'Intranet Website Redesign',
        summary: 'Unified intranet + internal learning system built for simple, accessible, low-friction staff workflows.',
        path: '/projects/reconstruction',
        image: '/imgs/12.png',
        meta: 'UX & enablement'
    },
    {
        slug: 'development-tracker',
        title: 'Development Projects Tracker',
        summary: 'Full-stack tracker for productivity, bookings, accounting, reporting, and system health.',
        path: '/projects/development-tracker',
        image: '/imgs/10.png',
        meta: 'SaaS dashboard'
    },
    {
        slug: 'odoo',
        title: 'Odoo ERP Customization',
        summary: 'Python + QWeb automations across CRM, Projects, Accounting, and HR.',
        path: '/projects/odoo',
        image: '/imgs/11.png',
        meta: 'Automation'
    },
    {
        slug: 'reebs',
        title: 'Party Rental Website & ERP',
        summary: 'Live storefront + ERP platform spanning bookings, inventory, accounting, delivery, and HR.',
        path: '/projects/reebs',
        image: '/imgs/21.png',
        meta: 'Live system'
    }
];

const getAdjacentProjects = (slug) => {
    const index = projectNavItems.findIndex((item) => item.slug === slug);
    const length = projectNavItems.length;
    const safeIndex = index === -1 ? 0 : index;

    return {
        prev: projectNavItems[(safeIndex - 1 + length) % length],
        next: projectNavItems[(safeIndex + 1) % length]
    };
};

const CaseNavCard = ({ direction, project }) => {
    const isPrev = direction === 'prev';
    const ArrowIcon = isPrev ? HiArrowLeft : HiArrowRight;
    const label = isPrev ? 'Previous project' : 'Next project';

    return (
        <Link
            className={`case-nav-card case-nav-card--${direction}`}
            to={project.path}
            aria-label={`${label}: ${project.title}`}
            data-scroll-reveal={isPrev ? 'fadeInLeft' : 'fadeInRight'}
        >
            <span className={`case-nav-card__label case-nav-card__label--${direction}`}>
                {isPrev ? (
                    <>
                        <ArrowIcon size={18} aria-hidden="true" className="case-nav-card__arrow" />
                        {label}
                    </>
                ) : (
                    <>
                        {label}
                        <ArrowIcon size={18} aria-hidden="true" className="case-nav-card__arrow" />
                    </>
                )}
            </span>
            <div className="case-nav-card__body">
                <div
                    className="case-nav-card__thumb"
                    style={{ backgroundImage: `url(${project.image})` }}
                    aria-hidden="true"
                />
                <div className="case-nav-card__text">
                    <p className="case-nav-card__eyebrow">{project.meta}</p>
                    <p className="case-nav-card__title">{project.title}</p>
                    <p className="case-nav-card__excerpt">{project.summary}</p>
                </div>
            </div>
        </Link>
    );
};

const CaseNav = ({ currentSlug }) => {
    const { prev, next } = getAdjacentProjects(currentSlug);

    return (
        <nav className="case-nav" aria-label="Project navigation">
            <CaseNavCard direction="prev" project={prev} />
            <CaseNavCard direction="next" project={next} />
        </nav>
    );
};

export default CaseNav;
