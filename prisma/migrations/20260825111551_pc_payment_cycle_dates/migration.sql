-- AlterTable
ALTER TABLE "PaymentCertificate" ADD COLUMN     "applicationDate" TIMESTAMP(3),
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "paymentReceivedDate" TIMESTAMP(3);
