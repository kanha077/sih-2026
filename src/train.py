import argparse

def main():
    parser = argparse.ArgumentParser(description="Fine-tuning script for monocular depth models")
    parser.add_argument("--data-dir", default="data/processed", help="Path to processed training pairs")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    
    args = parser.parse_args()
    print(f"Starting training with dataset from {args.data_dir} for {args.epochs} epochs...")
    # TODO: Load dataset and fine-tune depth backbone
    print("Training completed.")

if __name__ == "__main__":
    main()
