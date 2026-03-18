import { FaWhatsapp } from "react-icons/fa";

export default function WhatsApp() {
  return (
    <div className="whatsapp-container">
      {/* WhatsApp Floating Button */}
      <a
        href="https://wa.me/233XXXXXXXXX?text=Hi%20Faako%20team%2C%20I%27m%20interested%20in%20learning%20more%20about%20your%20website%2C%20dashboard%2C%20and%20ERP%20services"
        className="whatsapp-float"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
      >
        <FaWhatsapp className="whatsapp-icon" size={24} aria-hidden="true" />
      </a>
    </div>
  );
}
